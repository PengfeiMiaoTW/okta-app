class HelloController < ApplicationController
  def empty
    render json: { message: "Hello, world!" }
  end

  def create
    redirect_url = params['redirectUrl'] || params['RelayState'] || '/'
    path_fragments = redirect_url.split('/')

    if valid_route? path_fragments
      redirect_to redirect_url
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

end
