require 'omniauth'

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
