# discord_bot
アニメから1フレーム取り出して、それが何話かを当てる機能とかをもっているDiscordのbot

# 動かし方
1. Docker Composeを[インストール](https://docs.docker.jp/compose/install.html)する

1. 適当な空のディレクトリを作る

1. その中に`config`ディレクトリを作る

1. このリポジトリの`config/features-example.toml`を作った`config`ディレクトリに`features.toml`としてコピーする

1. `features.toml`の`discord_bot_token`にトークンを入れる

1. `assets`ディレクトリを作る

1. `assets`ディレクトリに`chino.png`という名前のかわいいチノちゃんの画像を配置する

1. こんな感じの`docker-compose.yaml`を作って
``` yaml
version: "3"
services:
  bot:
    image: ghcr.io/oriaca372m/discord_bot:latest
    volumes:
      - ./assets:/usr/src/app/assets
      - ./config:/usr/src/app/config
```

1. 実行
``` bash
$ docker-compose up
```

# ライセンス
Zlib License
