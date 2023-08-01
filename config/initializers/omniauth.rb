require 'omniauth'

Rails.application.config.middleware.use OmniAuth::Builder do
  provider :openid_connect, {
    name: :oidc,
    scope: [:openid, :email, :profile, :address],
    response_type: :code,
    uid_field: "email",
    discovery: true,
    issuer: "https://dev-19111685.okta.com",
    client_options: {
      # port: 443,
      scheme: "https",
      host: "dev-19111685.okta.com",
      identifier: ENV["CLIENT_ID"],
      secret: ENV["CLIENT_SECRET"],
      redirect_uri: ENV["REDIRECT_URI"],
      jwks_uri: '/keys'
    },
  }
end
