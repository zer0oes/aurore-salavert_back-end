module.exports = ({ env }) => ({
    url: env('MY_HEROKU_URL'),
    port: process.env.PORT,
});