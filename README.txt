To install node_modules:

  npm install

To run locally:

  # Note: this uses the development database. To use the production database
  # instead, do:
  #
  #  export DATABASE_URL=$(heroku config:get HEROKU_POSTGRESQL_WHITE_URL)?ssl=true
  #
  export HEROKU_APP=play-atlantis
  export NODE_TLS_REJECT_UNAUTHORIZED=0
  export DATABASE_URL=$(heroku config:get HEROKU_POSTGRESQL_MAROON_URL)?ssl=true
  node server.js
