Rails.application.routes.draw do
  root 'hello#empty'

  get 'hello' => 'hello#empty'

  post 'auth/:provider/callback' => 'auth#create'
  get 'auth/:provider/callback' => 'auth#create'
  # get 'auth/:provider/authorize' => 'auth#authorize'
  post 'auth/:provider' => 'auth#authorize'
  get 'auth/csrf_token' => 'auth#csrf_token'
end
