#!/usr/bin/env bash

set -e

# This script must be called with the following environment variables set:
#   - TARGET_HOSTS: comma- or colon-delimited list of hosts against which the playbook will run, which may be 'all'
: "${TARGET_HOSTS:?Variable TARGET_HOSTS not set or empty}"

# Additionally, the following environment variables may be set to override the default:
#   - PLAYBOOK: name of the playbook to run [playbook.yml]
#   - WORKSPACE_PATH: private directory for ansible-runner [$HOME/workspace]
#   - ARTIFACTS_TO_KEEP: maximum number of ansible-runner artifacts to keep [10]
: "${PLAYBOOK:=playbook.yml}"
: "${WORKSPACE_PATH:=$HOME/workspace}"
: "${ARTIFACTS_TO_KEEP:=10}"

# Load environment variables. These are initially populated by cloud-init, and contain the following values:
#   - PROJECT_REPOSITORY_URL: url of the ansible project repository
source /etc/ansible-runner/environment.sh

: "${PROJECT_REPOSITORY_URL:?Variable PROJECT_REPOSITORY_URL not set or empty}"

# clone repository, if needed
if [ ! -d "${WORKSPACE_PATH}" ]; then
  git clone "${PROJECT_REPOSITORY_URL}" "${WORKSPACE_PATH}"
fi

# get latest version of our Ansible code
cd "${WORKSPACE_PATH}"
git pull --rebase

# install any new Galaxy requirements
ansible-galaxy install -r project/requirements.yml

# Connect to the SSH agent. This SSH agent must have been previously started by an out-of-band process. 
# The environment file should export 'SSH_AUTH_SOCK' and 'SSH_AGENT_PID'.
if [ -f "$HOME/.ssh/environment" ]; then
  source $HOME/.ssh/environment
fi

ansible-runner run \
  "${WORKSPACE_PATH}" \
  --limit "${TARGET_HOSTS}" \
  --rotate-artifacts "${ARTIFACTS_TO_KEEP}" \
  -p "${PLAYBOOK}"
