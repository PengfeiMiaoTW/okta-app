# syntax=docker/dockerfile:experimental
FROM jruby:9.3-jdk11
WORKDIR /usr/src/app
ENV TZ=UTC
ARG CIRCLE_SHA1
ENV CIRCLE_SHA1 $CIRCLE_SHA1

RUN apt-get update && apt autoremove && apt-get -y upgrade \
  && apt-get -y install --no-install-recommends curl file git make netbase shared-mime-info openssh-client \
  && rm -rf /var/lib/apt/lists/*

RUN gem install bundler --pre
# 将应用程序的 Gemfile 和 Gemfile.lock 复制到容器中
COPY Gemfile Gemfile.lock ./

# 安装应用程序的依赖项
RUN jruby -S bundle install

# 将应用程序的所有内容复制到容器中
COPY . .

# 设置应用程序的默认环境变量
ENV RAILS_ENV=production

#EXPOSE 3000

ENTRYPOINT ["/bin/bash", "-c"]
# 运行应用程序
#CMD ["bundle", "exec", "rails", "s", "-p", "3000", "-b", "0.0.0.0"]
CMD ["bundle exec puma -e $RAILS_ENV -p 3000 -C config/puma.rb"]
