class ApplicationController < ActionController::Base
  before_action :require_jwt

  def require_jwt
    token = request.headers["Authorization"]
    unless token
      head :forbidden
    end
    unless valid_token(token)
      head :forbidden
    end
  end

  private

  def valid_token(token)
    unless token
      return false
    end

    token.gsub!('Bearer ', '')
    begin
      # typically you would cache this instead of making a call
      okta_keys_url = ENV["OKTA_URL"] + "/oauth2/default/v1/keys?client_id=" + ENV["CLIENT_ID"]
      jwks_raw = Net::HTTP.get URI(okta_keys_url)
      jwk_keys = Array(JSON.parse(jwks_raw, :symbolize_names => true)[:keys])

      token_payload = JWT.decode(token, nil, true, {
        algorithms: ['RS256'],
        jwks: { keys: jwk_keys }
      })
      # comment this out if you want to try the scopes example below
      # return true
      # uncomment this if you want to check for scopes
      scopes = token_payload[0]["scp"]
      return scopes.include? 'openid'
    rescue JWT::DecodeError => e
      puts(e)
      render json: { errors: ['Not Authenticated'] }, status: :unauthorized
    end
    false
  end
end
