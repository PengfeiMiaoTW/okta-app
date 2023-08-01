require 'rest-client'
require 'json'
require 'omniauth/strategies/openid_connect'

class AuthController < ApplicationController
  skip_before_action :require_jwt
  skip_before_action :verify_authenticity_token, only: :create
  protect_from_forgery except: :authorize

  def authorize
  end

  def create
    puts request.env.to_s
    render json: { user_info: request.env['omniauth.auth'] }
    #
    # redirect_url = params['redirectUrl'] || params['RelayState'] || '/'
    # path_fragments = redirect_url.split('/')
    #
    # if valid_route? path_fragments
    #   redirect_to redirect_url
    # else
    #   redirect_to '/'
    # end
  end

  def valid_route?(path_fragments)
    if path_fragments.size > 0
      path_fragment = path_fragments.first
      Rails.application.routes.routes.each do |route|
        return true if route.path.to_s.starts_with?("/#{path_fragment}")
      end
    end
  end

  def get_token(code)
    payload = 'grant_type=authorization_code&code=' + code + '&redirect_uri=' + ENV['REDIRECT_URI']
    response = RestClient::Request.execute(
      method: :post,
      url: ENV['OKTA_ISSUER'] + "/v1/token",
      user: ENV['CLIENT_ID'],
      password: ENV['CLIENT_SECRET'],
      payload: payload
    )

    token_response = JSON.parse(response.body)
    { 'Authorization' => "Bearer #{token_response['access_token']}" }
  end

  def csrf_token
    render json: { authenticity_token: form_authenticity_token }
  end
end