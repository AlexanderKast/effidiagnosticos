-- Seed: Equipos comerciales por país
-- Guatemala, Costa Rica, Rep. Dominicana, Ecuador

INSERT INTO public.commercial_calendars (name, email, calendar_id, status, country) VALUES

-- ============================================================
-- GUATEMALA (GT)
-- ============================================================
('Rosario Reyes',     'comercialeffigt1@gmail.com', 'comercialeffigt1@gmail.com', 'active', 'GT'),
('Cesia Villatoro',   'comercialeffigt4@gmail.com', 'comercialeffigt4@gmail.com', 'active', 'GT'),
('María López',       'comercialeffigt5@gmail.com', 'comercialeffigt5@gmail.com', 'active', 'GT'),
('Elizabeth Pereira', 'comercialeffigt6@gmail.com', 'comercialeffigt6@gmail.com', 'active', 'GT'),
('Estuardo García',   'comercialeffigt7@gmail.com', 'comercialeffigt7@gmail.com', 'active', 'GT'),
('Oscar Rodas',       'comercialeffigt8@gmail.com', 'comercialeffigt8@gmail.com', 'active', 'GT'),

-- ============================================================
-- COSTA RICA (CR)
-- ============================================================
('Verónica García',   'comercial1cr.efficommerce@gmail.com', 'comercial1cr.efficommerce@gmail.com', 'active', 'CR'),
('Christopher Ugalde','comercial2cr.effisystems@gmail.com',  'comercial2cr.effisystems@gmail.com',  'active', 'CR'),
('Katherine Vásquez', 'comercial3cr.efficommerce@gmail.com', 'comercial3cr.efficommerce@gmail.com', 'active', 'CR'),
('Katherine López',   'comercial4cr.efficommerce@gmail.com', 'comercial4cr.efficommerce@gmail.com', 'active', 'CR'),
('Karla Ramírez',     'comercial2cr.efficommerce@gmail.com', 'comercial2cr.efficommerce@gmail.com', 'active', 'CR'),
('Alberto Navas',     'comercial3cr.effisystems@gmail.com',  'comercial3cr.effisystems@gmail.com',  'active', 'CR'),

-- ============================================================
-- REPÚBLICA DOMINICANA (DO)
-- ============================================================
('Frank',             'comercialeffi1rd@gmail.com', 'comercialeffi1rd@gmail.com', 'active', 'DO'),
('Pedro',             'comercialeffi2rd@gmail.com', 'comercialeffi2rd@gmail.com', 'active', 'DO'),
('Rosmery',           'comercialeffi3rd@gmail.com', 'comercialeffi3rd@gmail.com', 'active', 'DO'),
('Oranyelis',         'comercialeffi4rd@gmail.com', 'comercialeffi4rd@gmail.com', 'active', 'DO'),
('Jean',              'comercialeffi5rd@gmail.com', 'comercialeffi5rd@gmail.com', 'active', 'DO'),
('Deborah',           'comercialeffi6rd@gmail.com', 'comercialeffi6rd@gmail.com', 'active', 'DO'),

-- ============================================================
-- ECUADOR (EC)
-- ============================================================
('David',             'davidefficommerce593@gmail.com',         'davidefficommerce593@gmail.com',         'active', 'EC'),
('Alejandro Carbo',   'alejandrocarbocomercialuio@gmail.com',   'alejandrocarbocomercialuio@gmail.com',   'active', 'EC'),
('Nicole',            'nicolecomercialeffiuio@gmail.com',       'nicolecomercialeffiuio@gmail.com',       'active', 'EC'),
('Comercial Ecuador', 'comercial2g.ecuador@gmail.com',          'comercial2g.ecuador@gmail.com',          'active', 'EC')

ON CONFLICT DO NOTHING;
