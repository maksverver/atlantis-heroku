To install node_modules:

  npm install

To run locally:

  # Note: this uses the production database!
  # To use the testing database instead, get its credentials like this:
  #
  #   heroku pg:credentials:url HEROKU_POSTGRESQL_MAROON_URL
  #
  # Be sure to add ?ssl=true to the URL. Secure connection is required.

  export DATABASE_URL=$(heroku config:get DATABASE_URL)?ssl=true
  node server.js
