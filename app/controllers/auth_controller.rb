require 'rest-client'
require 'json'

class AuthController < ApplicationController
  skip_before_action :require_jwt

  def authorize
    redirect_url = params['redirectUrl'] || params['RelayState'] || '/'
    params = {
      'client_id' => ENV['CLIENT_ID'],
      'response_type' => 'code',
      'response_mode' => 'query',
      'scope' => 'openid',
      'state' => redirect_url,
      'redirect_uri' => ENV['REDIRECT_URI']
    }
    param_strings = params.map { |key, value| "#{key}=#{value}" }
    param_string = param_strings.join('&')
    authorize_url = ENV['OKTA_URL'] + "/oauth2/default/v1/authorize?" + param_string
    redirect_to authorize_url
  end

  def callback
    redirect_url = params['redirectUrl'] || params['state'] || '/'
    path_fragments = redirect_url.split('/')
    code = params['code'] || ''

    if valid_route? path_fragments
      if code.empty?
        redirect_to redirect_url
      else
        token_header = get_token(code)
        puts token_header['Authorization']
        redirect_to redirect_url, headers: token_header
      end
    else
      redirect_to '/'
    end
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
      url: ENV['OKTA_URL'] + "/oauth2/default/v1/token",
      user: ENV['CLIENT_ID'],
      password: ENV['CLIENT_SECRET'],
      payload: payload
    )

    token_response = JSON.parse(response.body)
    { 'Authorization' => "Bearer #{token_response['access_token']}" }
  end
end