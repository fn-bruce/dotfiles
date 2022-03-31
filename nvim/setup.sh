# check if node is installed
if which node > /dev/null
  then
    echo "node is installed"
  else
    echo "please install node"
    exit 1
fi

# check if dotnet is installed
if which dotnet > /dev/null
  then
    echo "dotnet is installed"
  else
    echo "please install dotnet"
    exit 1
fi

# check if pipx is installed
if which pipx > /dev/null
  then
    echo "pipx is installed"
  else
    echo "please install pipx"
    exit 1
fi

# check if ninja is installed
if which ninja > /dev/null
  then
    echo "ninja is installed"
  else
    echo "please install ninja"
    exit 1
fi

# vimls
npm install -g vim-language-server

# bashls
npm install -g bash-language-server

# tsserver
npm install -g typescript typescript-language-server

# html
npm install -g vscode-langservers-extracted

# emmet
npm install -g emmet-ls

# typescript
npm install -g typescript typescript-language-server

# docker
npm install -g dockerfile-language-server-nodejs

# pylsp
pipx install 'python-lsp-server[all]'

# c#
dotnet tool install --global csharp-ls

# elixir
curl -fLO https://github.com/elixir-lsp/elixir-ls/releases/latest/download/elixir-ls.zip
unzip elixir-ls.zip -d $HOME/projects/github/elixir-ls
rm elixir-ls.zip
chmod +x $HOME/projects/github/elixir-ls/language_server.sh
