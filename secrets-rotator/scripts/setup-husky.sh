function install_husky() {
  echo "Installing husky"
  rm -rf .husky
  npx husky install
}

function add_pre_commit_hook() {
 echo "Adding pre commit hook"
 npx husky add .husky/pre-commit "export PATH=/usr/local/bin/:$PATH && yarn pre-commit"
}

function add_pre_push_hook() {
 echo "Adding pre push hook"
 npx husky add .husky/pre-push "export PATH=/usr/local/bin/:$PATH && yarn pre-push"
}

install_husky
add_pre_commit_hook
add_pre_push_hook
