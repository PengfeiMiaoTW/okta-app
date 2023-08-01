# Okta with SAML vs. OIDC
 - OIDC workflow: https://developer.okta.com/docs/guides/implement-grant-type/authcode/main/#request-an-authorization-code
 - SAML workflow: https://developer.okta.com/docs/concepts/saml/#understanding-sp-initiated-sign-in-flow

# Setup an OIDC WebApp on okta
 - official document: https://developer.okta.com/docs/guides/authorization/

参考官方文档，只需要设置以下两步：
> 1. Implement by grant type
> 2. Create an authorization server

1. [Set up your app](https://developer.okta.com/docs/guides/implement-grant-type/authcode/main/#set-up-your-app)
 - Open the Admin Console for your org.
 - Choose Applications > Applications to view the current app integrations.
 - Click Create App Integration.
 - Select OIDC - OpenID Connect as the Sign-in method.
 - Select Web Application as the Application type, then click Next.
 - Enter the App integration name.
 - In the Sign-in redirect URIs box, enter the callback location where Okta returns the browser (along with their authorization code).
 - Fill in the remaining details for your app integration, then click Save.

2. 在自己的应用中实现对应的callback方法
 - /auth/:provider/callback, 可以先写一个空方法用来调试

3. [create an Authorization Server](https://developer.okta.com/docs/guides/customize-authz-server/main/)
 - Okta官方提供了 Authorization Server 作为 api 的授权服务器，每个Okta账户都有默认的 Authorization Server，<br>
   可以根据实际需求选择是否新建一个独立的 Authorization Server（比如安全考虑）

# Integrate Okta to Ruby
 - \[github\] omniauth_openid_connect: https://github.com/omniauth/omniauth_openid_connect

1. Gemfile 添加相关依赖
```ruby
gem 'omniauth_openid_connect', '0.6.1'
gem "omniauth-rails_csrf_protection", "~> 1.0"
```

2. 在okta-app的config/initializers/下创建omniauth.rb文件，根据官方文档添加如下配置：
```ruby
Rails.application.config.middleware.use OmniAuth::Builder do
   provider :openid_connect, {
      name: :oidc,
      scope: [:openid, :email, :profile, :address],
      response_type: :code,
      uid_field: "email",
      discovery: true,
      issuer: "https://#{ENV["OP_HOST"]}",
      client_options: {
         # port: 443,
         scheme: "https",
         host: ENV["OP_HOST"],
         identifier: ENV["OP_CLIENT_ID"],
         secret: ENV["OP_CLIENT_SECRET"],
         redirect_uri: ENV["OP_REDIRECT_URI"],
         jwks_uri: '/keys'
      },
   }
end
```

3. 在lib目录下新建json/monkey_patching.rb
> 由于 omniauth_openid_connect 的 ominiauth/strategies/openid_connect.rb文件中<br>
line 304 的`decoded.verify!(keyset)`代码调用到的 JSON::JWT.to_rsa_key 方法存在bug，<br>
需要对to_rsa_key方法做monkey_patch修复，monkey_patching.rb代码如下：
```ruby
module MonkeyPatching
  module JSON
    module MyJWK
      private
      def to_rsa_key
        # super
        e, n, d, p, q, dp, dq, qi = [:e, :n, :d, :p, :q, :dp, :dq, :qi].collect do |key|
          if self[key]
            OpenSSL::BN.new Base64.urlsafe_decode64(self[key]), 2
          end
        end

        # Public key
        data_sequence = OpenSSL::ASN1::Sequence([
          OpenSSL::ASN1::Integer(n),
          OpenSSL::ASN1::Integer(e),
        ])

        if d && p && q && dp && dq && qi
          data_sequence = OpenSSL::ASN1::Sequence([
            OpenSSL::ASN1::Integer(0),
            OpenSSL::ASN1::Integer(n),
            OpenSSL::ASN1::Integer(e),
            OpenSSL::ASN1::Integer(d),
            OpenSSL::ASN1::Integer(p),
            OpenSSL::ASN1::Integer(q),
            OpenSSL::ASN1::Integer(dp),
            OpenSSL::ASN1::Integer(dq),
            OpenSSL::ASN1::Integer(qi),
          ])
        end

        # asn1 = OpenSSL::ASN1::Sequence(data_sequence) # 有bug的代码就是这两行，已注释
        OpenSSL::PKey::RSA.new(data_sequence.to_der)
      end
    end
  end
end

::JSON::JWK.prepend MonkeyPatching::JSON::MyJWK
```

4. 在启动类config/application.rb中添加初始化配置
```ruby   
# 兼容性配置，ominiauth_openid_connect不支持rack_csrf, 具体说明见 ominiauth/ominiauth 的官方文档
OmniAuth::AuthenticityTokenProtection.default_options(key: "csrf.token", authenticity_param: "_csrf")

# 导入 monkey_patch 代码
require File.expand_path('../../lib/json/monkey_patching', __FILE__)
```

5. 在 app 中新建 application_controller.rb，构建 require_jwt 方法用于 before_action 校验 token
```ruby
class ApplicationController < ActionController::Base
  before_action :require_jwt

  def require_jwt
    token = request.headers["Authorization"]
    unless token && valid_token(token)
      head :forbidden
    end
  end

  private

  def valid_token(token)
    token.gsub!('Bearer ', '')
    begin
      # typically you would cache this instead of making a call
      okta_keys_url = "https://#{ENV["OP_HOST"]}/oauth2/v1/keys?client_id=#{ENV["OP_CLIENT_ID"]}"
      jwks_raw = Net::HTTP.get URI(okta_keys_url)
      jwk_keys = Array(JSON.parse(jwks_raw, :symbolize_names => true)[:keys])

      token_payload = JWT.decode(token, nil, true, {
        algorithms: ['RS256'],
        jwks: { keys: jwk_keys }
      })
      return !token_payload.nil?
    rescue JWT::DecodeError => e 
      Rails.logger.error(e)
      render json: { errors: ['Not Authenticated'] }, status: :unauthorized
    end
    false
  end
end
```

6. 认证过程
> 前提是确保代码已经定义了以下接口，接口实现可以参考本项目 app/controllers/auth_controller.rb
 - 调用 GET /auth/csrf_token 接口获取 csrf_token，下一步中的 POST 请求需要带上请求头 X-CSRF-Token 来满足 csrf-protection 策略
 - 调用 POST/auth/:provider 接口，向 okta 发起认证请求
 - okta 回调 /auth/:provider/callback 接口，通过 request.env['omniauth.auth'] 可以获取到用户的 credentials、principal 等信息
 - 调用 任意需要 require_jwt 校验的接口，比如 GET /hello，Authorization 请求头带上上一步获取到的 credentials 中的 id_token，则请求可以通过 require_jwt 的认证

# Compatible with ui tests
 - 只需要注意接口的重定向等逻辑的mock，和原来的saml集成方式基本一致