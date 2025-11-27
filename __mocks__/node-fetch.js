const fetch = jest.fn();
fetch.default = fetch;

module.exports = fetch;
