import { PresentationChart } from '@strapi/icons';

export default {
  register(app) {
    app.addMenuLink({
      to: 'plugins/site-analytics', icon: PresentationChart,
      intlLabel: { id: 'site-analytics.name', defaultMessage: 'Statistiques' },
      Component: () => import('./admin/src/Report'),
      permissions: [{ action: 'plugin::site-analytics.read', subject: null }],
    });
    app.registerPlugin({ id: 'site-analytics', name: 'Statistiques' });
  },
};
