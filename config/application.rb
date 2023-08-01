require_relative "boot"

require "rails/all"

Bundler.require(*Rails.groups)

module OktaApp
  class Application < Rails::Application
    config.load_defaults 6.1

    OmniAuth::AuthenticityTokenProtection.default_options(key: "csrf.token", authenticity_param: "_csrf")

    require File.expand_path('../../lib/json/monkey_patching', __FILE__)
  end
end
