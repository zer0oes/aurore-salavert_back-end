'use strict';

const LOCAL_PUBLIC_READ_ACTIONS = [
  'api::project.project.find',
  'api::project.project.findOne',
  'api::category.category.find',
  'api::category.category.findOne',
  'api::layout.layout.find',
  'api::layout.layout.findOne',
  'api::skill.skill.find',
  'api::skill.skill.findOne',
  'api::showcase.showcase.find',
  'api::competence.competence.find',
  'api::service.service.find',
  'api::contact.contact.find',
  'api::slider-item.slider-item.find',
  'api::slider-item.slider-item.findOne',
  'api::social-network.social-network.find',
  'api::social-network.social-network.findOne',
  'api::privacy-policy.privacy-policy.find',
];

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    // Navigation and cookie banner labels are public content; expose only their read action.
    const menuPublicRole = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: 'public' },
    });
    if (menuPublicRole) {
      const permissions = strapi.db.query('plugin::users-permissions.permission');
      for (const action of ['api::menu.menu.find', 'api::cookie-banner.cookie-banner.find']) {
        const existing = await permissions.findOne({ where: { action, role: menuPublicRole.id } });
        if (!existing) {
          await permissions.create({ data: { action, role: menuPublicRole.id } });
        }
      }
    }

    if (process.env.NODE_ENV === 'production') {
      return;
    }

    const sliderUid = 'api::slider-item.slider-item';
    const contentTypes = strapi.plugin('content-manager').service('content-types');
    const sliderType = strapi.contentTypes[sliderUid];
    const sliderConfiguration = await contentTypes.findConfiguration(sliderType);
    if (sliderConfiguration.settings.mainField !== 'Title') {
      await contentTypes.updateConfiguration(sliderType, {
        ...sliderConfiguration,
        settings: { ...sliderConfiguration.settings, mainField: 'Title' },
      });
    }
    await strapi.db.query(sliderUid).updateMany({
      where: { $or: [{ Title: { $null: true } }, { Title: '' }] },
      data: { Title: 'Slider d’accueil' },
    });

    const roleRepository = strapi.db.query('plugin::users-permissions.role');
    const permissionRepository = strapi.db.query('plugin::users-permissions.permission');
    const publicRole = await roleRepository.findOne({
      where: { type: 'public' },
      populate: ['permissions'],
    });

    if (!publicRole) {
      strapi.log.warn('Local public role not found; public read permissions were not configured.');
      return;
    }

    const existingActions = new Set(publicRole.permissions.map(({ action }) => action));
    const missingActions = LOCAL_PUBLIC_READ_ACTIONS.filter(
      (action) => !existingActions.has(action)
    );

    await Promise.all(
      missingActions.map((action) =>
        permissionRepository.create({ data: { action, role: publicRole.id } })
      )
    );

    if (missingActions.length > 0) {
      strapi.log.info(`Enabled ${missingActions.length} local public read permissions.`);
    }
  },
};
