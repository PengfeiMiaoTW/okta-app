require "test_helper"

class HelloControllerTest < ActionDispatch::IntegrationTest
  test "should get empty" do
    get hello_empty_url
    assert_response :success
  end
end
