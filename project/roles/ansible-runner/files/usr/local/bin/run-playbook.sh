#!/usr/bin/env bash

set -e

# This script must be called with the following environment variables set:
#   - TARGET_HOSTS: comma- or colon-delimited list of hosts against which the playbook will run, which may be 'all'
: "${TARGET_HOSTS:?Variable TARGET_HOSTS not set or empty}"

# Load environment variables. These are initially populated by cloud-init
source /etc/ansible-runner/environment.sh

: "${WORKSPACE_PATH:?Variable WORKSPACE_PATH not set or empty}"
: "${PROJECT_PATH:?Variable PROJECT_PATH not set or empty}"
: "${VAULT_PATH:?Variable VAULT_PATH not set or empty}"
: "${PROJECT_REPOSITORY_URL:?Variable PROJECT_REPOSITORY_URL not set or empty}"
: "${VAULT_REPOSITORY_URL:?Variable VAULT_REPOSITORY_URL not set or empty}"

# Connect to the SSH agent. This SSH agent must have been previously started via `/usr/local/bin/unlock.sh`
# The environment file should export 'SSH_AUTH_SOCK' and 'SSH_AGENT_PID'.
if [ ! -f "$HOME/.ssh/environment" ]; then
  echo "The ssh keys are not unlocked! Run /usr/local/bin/unlock.sh from a terminal."
  echo "Aborting."
  exit 1
else
  . "$HOME/.ssh/environment" > /dev/null
  ps -ef | grep ${SSH_AGENT_PID} | grep ssh-agent$ > /dev/null || {
    rm "$HOME/.ssh/environment"
    echo "The ssh-agent is no longer running. Run /usr/local/bin/unlock.sh from a terminal."
    echo "Aborting."
    exit 1
  }
fi

source $HOME/.ssh/environment

# get latest version of our Ansible code and variables
cd "${VAULT_PATH}"
git pull --rebase
cd "${PROJECT_PATH}"
git pull --rebase

# install any new Galaxy requirements
ansible-galaxy install -r project/requirements.yml

ansible-runner run \
  "${PROJECT_PATH}" \
  --limit "${TARGET_HOSTS}" \
  --rotate-artifacts 10 \
  -p playbook.yml
