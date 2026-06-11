exports.up = (pgm) => {
  pgm.dropColumns('pets', ['qr_code']);
};

exports.down = (pgm) => {
  pgm.addColumn('pets', {
    qr_code: { type: 'text', notNull: false },
  });
};
