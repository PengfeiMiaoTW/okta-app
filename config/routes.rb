Rails.application.routes.draw do
  root 'hello#empty'

  get '/hello' => 'hello#empty'

  post 'auth/:provider/callback' => 'hello#create'
  get 'auth/:provider/callback' => 'hello#create'
end
