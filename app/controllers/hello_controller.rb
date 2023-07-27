class HelloController < ApplicationController
  def empty
    Rails.logger.debug "Request: #{request.method} #{request.fullpath}"
    render json: { message: "Hello, world!" }
  end

end
