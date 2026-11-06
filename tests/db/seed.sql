-- camap characterisation tests: base rows present before every test.
-- Replayed by tests/src/db/reset.ts after truncating every table (and loaded
-- once by the MySQL initdb). Keep it minimal: tests build their own data with
-- the factories (tests/src/factories).
--
-- The md5 salt below must equal `key` in tests/stack/config.test.xml.

-- Terms-of-service versions read by camap-ts at login/registration
-- (camap-ts/packages/api-core/src/dev/dataset-generator.ts genBaseConfig,
--  names from tools/variable.service.ts VariableNames).
INSERT INTO `Variable` (`name`, `value`) VALUES
  ('tosVersion', '1'),
  ('platformtermsofservice', '1');

-- Superadmin created at first install (UND-107: kept as admin@camap.tld /
-- "admin"; camap-hx/src/controller/Install.hx). rights = SFlags(Admin) = 1.
-- pass2 empty: the first TS login upgrades it from the md5 password.
INSERT INTO `User` (`id`, `lang`, `pass`, `pass2`, `rights`, `firstName`, `lastName`, `email`, `cdate`, `flags`)
VALUES (1, 'fr', MD5(CONCAT('camap-test-key-0123456789', 'admin')), '', 1, 'Admin', 'CAMAP', 'admin@camap.tld',
        '2020-01-01 00:00:00', 2);

-- Placeholder that receives the data of deleted accounts (UND-110: created at
-- install and by a migration; camap-ts users.service.ts delete). No password.
INSERT INTO `User` (`id`, `lang`, `pass`, `pass2`, `rights`, `firstName`, `lastName`, `email`, `cdate`, `flags`)
VALUES (2, 'fr', '', '', 0, 'Compte', 'Supprimé', 'deleted@camap.tld', '2020-01-01 00:00:00', 0);
