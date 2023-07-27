Rails.application.routes.draw do
  root 'hello#empty'

  get '/hello' => 'hello#empty'

  post 'auth/:provider/callback' => 'auth#callback'
  get 'auth/:provider/callback' => 'auth#callback'
  get 'auth/:provider/authorize' => 'auth#authorize'
end
