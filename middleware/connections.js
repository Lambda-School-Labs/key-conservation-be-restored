// checks if a user is already connected to another to prevent multiple connections between the same users
const Connections = require('../models/connectionsModel');

const checkConnection = async (req, res, next) => {
  const allConnections = await Connections.getConnectionsByUserId(
    req.params.id
  );
  let found = allConnections.find(
    connection => connection.connected_id === req.body.connected_id
  );

  if (found) {
    res.status(403).json({ msg: 'Users are already connected' });
  } else {
    next();
  }
};

module.exports = {
  checkConnection
};
