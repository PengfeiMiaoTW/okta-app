# syntax=docker/dockerfile:experimental
FROM debian:11.6-slim
WORKDIR /usr/src/app
ENV TZ=UTC
ARG CIRCLE_SHA1
ENV CIRCLE_SHA1 $CIRCLE_SHA1

# Fix for openjdk installation
# https://github.com/debuerreotype/docker-debian-artifacts/issues/24
RUN mkdir -p /usr/share/man/man1

RUN apt-get update && apt autoremove && apt-get -y upgrade \
  && apt-get -y install --no-install-recommends curl openjdk-11-jre file nginx git make netbase shared-mime-info openssh-client \
  && curl -sL https://deb.nodesource.com/setup_16.x  | bash - \
  && apt-get -y install --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

ENV JRUBY_VERSION 9.3.9.0
RUN mkdir /opt/jruby \
  && curl -sSL https://s3.amazonaws.com/jruby.org/downloads/${JRUBY_VERSION}/jruby-bin-${JRUBY_VERSION}.tar.gz \
  | tar -zxC /opt/jruby --strip-components=1 \
  && update-alternatives --install /usr/local/bin/ruby ruby /opt/jruby/bin/jruby 1
ENV PATH /opt/jruby/bin:$PATH

RUN mkdir -p /var/jigsaw/log \
  && mkdir -p /usr/src/app/log \
  && touch ./log/automation.log ./log/development.log ./log/test.log \
  ./log/staging.log ./log/production.log ./log/dev.log

RUN gem install bundler
COPY Gemfile ./Gemfile
COPY Gemfile.lock ./Gemfile.lock
RUN mkdir -p -m 0600 ~/.ssh && ssh-keyscan github.com >> ~/.ssh/known_hosts
RUN jruby -S bundle install

COPY public/ ./public/
COPY webpack-assets.json ./

COPY app/ ./app/
COPY config/ ./config/
COPY db/ ./db/
COPY lib/ ./lib/
COPY script/ ./script/
COPY Rakefile config.ru ./
COPY fixtures/ ./fixtures/

COPY swagger/ ./swagger/
RUN jruby -S bundle exec rake docs:generate --trace

COPY factories/ ./factories/
COPY spec/ ./spec/

COPY build_info ./public/

ENTRYPOINT ["/bin/bash", "-c"]
CMD ["echo \"App start time: $(date)\" >> /usr/src/app/public/build_info && nginx -c /usr/src/app/config/nginx/jigsaw.conf & bundle exec puma -e $RAILS_ENV -p 3001 -C config/puma.rb"]
