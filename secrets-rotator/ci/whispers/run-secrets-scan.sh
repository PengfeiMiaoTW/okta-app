#!/bin/bash
# Do the whispers scan.
whispers --severity CRITICAL,BLOCKER,MAJOR,MINOR --config ./ci/whispers/whispers-config.yml . -o whispers-findings.out
findings_count=`cat whispers-findings.out | wc -l`
if [[ ${findings_count} -gt 0 ]];
then
    echo "Failed: secret identified!";
    cat whispers-findings.out;
    exit 1;
else
    echo "Success: no secret identified!";
fi
