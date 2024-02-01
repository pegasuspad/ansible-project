if [ -n "$BASH_VERSION" ]; then
  if [ -f "$HOME/.bashrc" ]; then
    . "$HOME/.bashrc"
  fi
  if [ -f "$HOME/.bashrc_ssh" ]; then
    . "$HOME/.bashrc_ssh"
  fi
fi

if [ -d "$HOME/bin" ] ; then
  PATH="$HOME/bin:$HOME/.local/bin:$PATH"
fi