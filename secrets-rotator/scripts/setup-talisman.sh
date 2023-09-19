function setup_talisman()
{
   echo "Setting up Talisman"
   rm -rf .git/hooks
   echo "Removed existing hooks"
   TALISMAN_URL="https://raw.githubusercontent.com/thoughtworks/talisman/master/global_install_scripts/install.bash"
   curl --silent  $TALISMAN_URL > /tmp/install_talisman.bash && /bin/bash /tmp/install_talisman.bash
}

setup_talisman
