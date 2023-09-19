#!/bin/sh -el
export PATH=$(pwd)/gcp/tools:$PATH

ENV=${1:-dev}
if [ ${ENV} != "dev" ] && [ ${ENV} != "staging" ] && [ ${ENV} != "qa" ] && [ ${ENV} != "production" ]; then
  echo "Invalid environment provided"
  exit 1
fi

CURRENT_APP_ENGINE_RUNNING_VERSION_ID=$(gcloud app versions list --service=${ENV} --filter SERVING_STATUS=SERVING | awk '{if (NR==2) {print $2}}')

restart_app_engine() {
  echo Restarting app engine of environment:${ENV} and appEngineVersionID:${CURRENT_APP_ENGINE_RUNNING_VERSION_ID}
  gcloud --quiet app versions stop --service=${ENV} ${CURRENT_APP_ENGINE_RUNNING_VERSION_ID}
  gcloud --quiet app versions start --service=${ENV} ${CURRENT_APP_ENGINE_RUNNING_VERSION_ID}
  echo Restarting app engine is completed
}

restart_app_engine

