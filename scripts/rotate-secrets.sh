#!/bin/bash -el
set -e

FILE_PATH=${1}

# This script is used to rotate secrets like db password and api keys in api platform using secrets-rotator tool
# This script takes the config file path as a command line argument

add_secrets_rotator_cli() {
  echo "Installing secrets_rotator_cli"
  yarn add git+ssh://git@github.com:Digital-Innovation-Labs/secrets-rotator.git
}

rotate_secrets() {
  echo "Rotating secrets"
  yarn secrets-rotator rotate -c $FILE_PATH
  echo "Completed rotating secrets"
}

add_secrets_rotator_cli
rotate_secrets