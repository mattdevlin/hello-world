export function seed(db) {
  const insertPricing = db.prepare(
    `INSERT OR IGNORE INTO pricing (category, unit, unit_cost, description) VALUES (?, ?, ?, ?)`
  );

  const insertMargin = db.prepare(
    `INSERT OR IGNORE INTO margins (key, value, label) VALUES (?, ?, ?)`
  );

  const insertSetting = db.prepare(
    `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`
  );

  const seedAll = db.transaction(() => {
    // Default unit costs (placeholder values — update via admin UI)
    insertPricing.run('magboard', 'sheet', 85.0, 'Magboard 1200×2745/3050');
    insertPricing.run('eps', 'block', 45.0, 'EPS Block 4900×1220×630');
    insertPricing.run('glue', 'litre', 18.0, 'PU Adhesive');
    insertPricing.run('timber', 'lineal_metre', 6.5, 'Framing Timber');

    // Default markups
    insertMargin.run('magboard_markup', 0.3, 'Magboard Markup');
    insertMargin.run('eps_markup', 0.25, 'EPS Markup');
    insertMargin.run('glue_markup', 0.2, 'Glue Markup');
    insertMargin.run('timber_markup', 0.2, 'Timber Markup');
    insertMargin.run('global_overhead', 0.1, 'Global Overhead');

    // Default settings
    insertSetting.run('default_validity_days', '30');
    insertSetting.run('gst_rate', '0.15');
    insertSetting.run('company_name', 'Devlin Property');
    insertSetting.run('company_phone', '');
    insertSetting.run('company_email', '');
    insertSetting.run(
      'terms_and_conditions',
      [
        '1. This quotation is valid for the period specified above.',
        '2. Prices are in New Zealand Dollars (NZD) and exclude GST unless stated otherwise.',
        '3. Payment terms: 50% deposit on acceptance, balance due on delivery.',
        '4. Delivery timeframes are estimates only and subject to material availability.',
        '5. This quote covers supply of materials only. Installation is not included unless explicitly stated.',
        '6. Any variations to the scope of work may result in additional charges.',
      ].join('\n')
    );
  });

  seedAll();
}
