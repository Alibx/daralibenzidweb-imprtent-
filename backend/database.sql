SET FOREIGN_KEY_CHECKS=0;
SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- ======================
-- Create Tables (MySQL / InnoDB / utf8mb4)
-- ======================

CREATE TABLE IF NOT EXISTS `about` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `main_text` TEXT,
    `mission` TEXT,
    `vision` TEXT,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admins` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(100) NOT NULL,
    `name` VARCHAR(255) DEFAULT 'المسؤول',
    `password_hash` VARCHAR(255) NOT NULL,
    `role` VARCHAR(50) DEFAULT 'admin',
    `is_active` TINYINT(1) DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `categories` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `color` VARCHAR(50) DEFAULT '#1B6CA8',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `books` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(500) NOT NULL,
    `author` VARCHAR(255) NOT NULL,
    `description` TEXT,
    `cover_url` MEDIUMTEXT,
    `pdf_url` MEDIUMTEXT,
    `year` INT DEFAULT NULL,
    `pages` INT DEFAULT NULL,
    `price` DECIMAL(10,2) DEFAULT 1200.00,
    `discount_price` DECIMAL(10,2) DEFAULT NULL,
    `pdf_price` DECIMAL(10,2) DEFAULT 5.00,
    `color` VARCHAR(50) DEFAULT NULL,
    `status` VARCHAR(20) DEFAULT 'published',
    `category_id` INT DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_category_id` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `orders` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `book_id` INT NOT NULL,
    `book_title` VARCHAR(500) NOT NULL,
    `customer_name` VARCHAR(255) NOT NULL,
    `customer_phone` VARCHAR(100) NOT NULL,
    `wilaya_code` INT NOT NULL,
    `wilaya_name` VARCHAR(100) NOT NULL,
    `commune` VARCHAR(255) NOT NULL,
    `address` TEXT NOT NULL,
    `delivery_type` VARCHAR(50) DEFAULT 'home',
    `quantity` INT DEFAULT 1,
    `items` LONGTEXT DEFAULT NULL,
    `book_price` DECIMAL(10,2) NOT NULL,
    `delivery_price` DECIMAL(10,2) NOT NULL,
    `discount_amount` DECIMAL(10,2) DEFAULT 0.00,
    `coupon_code` VARCHAR(100) DEFAULT NULL,
    `total_price` DECIMAL(10,2) NOT NULL,
    `payment_method` VARCHAR(50) DEFAULT 'cod',
    `payment_status` VARCHAR(50) DEFAULT 'pending',
    `notes` TEXT,
    `status` VARCHAR(50) DEFAULT 'pending',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_status` (`status`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `manuscripts` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `author_name` VARCHAR(255) NOT NULL,
    `author_phone` VARCHAR(100) NOT NULL,
    `author_email` VARCHAR(255) DEFAULT NULL,
    `wilaya` VARCHAR(100) DEFAULT NULL,
    `book_title` VARCHAR(500) NOT NULL,
    `category` VARCHAR(255) DEFAULT NULL,
    `pages_count` INT DEFAULT NULL,
    `summary` TEXT,
    `file_url` MEDIUMTEXT,
    `status` VARCHAR(50) DEFAULT 'pending',
    `admin_notes` TEXT,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `book_reviews` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `book_id` INT NOT NULL,
    `reviewer_name` VARCHAR(255) NOT NULL,
    `rating` INT NOT NULL DEFAULT 5,
    `comment` TEXT,
    `is_approved` TINYINT(1) DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_book_id` (`book_id`),
    KEY `idx_is_approved` (`is_approved`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `coupons` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(100) NOT NULL UNIQUE,
    `discount_type` VARCHAR(20) DEFAULT 'percent',
    `discount_value` DECIMAL(10,2) NOT NULL,
    `min_order` DECIMAL(10,2) DEFAULT 0.00,
    `max_uses` INT DEFAULT NULL,
    `used_count` INT DEFAULT 0,
    `expires_at` DATE DEFAULT NULL,
    `is_active` TINYINT(1) DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `delivery_rates` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `wilaya_code` INT NOT NULL UNIQUE,
    `wilaya_name` VARCHAR(100) NOT NULL,
    `home_price` DECIMAL(10,2) DEFAULT 600.00,
    `desk_price` DECIMAL(10,2) DEFAULT 400.00,
    `is_available` TINYINT(1) DEFAULT 1,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `contact` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `address` TEXT,
    `phone` VARCHAR(100) DEFAULT NULL,
    `phone2` VARCHAR(100) DEFAULT NULL,
    `email` VARCHAR(255) DEFAULT NULL,
    `hours` VARCHAR(255) DEFAULT NULL,
    `facebook` VARCHAR(500) DEFAULT NULL,
    `instagram` VARCHAR(500) DEFAULT NULL,
    `whatsapp` VARCHAR(100) DEFAULT NULL,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `messages` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) DEFAULT NULL,
    `subject` VARCHAR(500) DEFAULT NULL,
    `message` TEXT NOT NULL,
    `is_read` TINYINT(1) DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `milestones` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `year` INT DEFAULT NULL,
    `title` VARCHAR(500) DEFAULT NULL,
    `description` TEXT,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `settings` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `hero_title` VARCHAR(500) DEFAULT NULL,
    `hero_subtitle` VARCHAR(500) DEFAULT NULL,
    `stat_years` VARCHAR(50) DEFAULT NULL,
    `stat_books` VARCHAR(50) DEFAULT NULL,
    `stat_readers` VARCHAR(50) DEFAULT NULL,
    `copyright` VARCHAR(500) DEFAULT NULL,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `testimonials` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `role` VARCHAR(255) DEFAULT NULL,
    `content` TEXT,
    `quote` TEXT,
    `rating` INT DEFAULT 5,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ======================
-- Insert Initial Data
-- ======================

INSERT INTO `about` (`id`, `main_text`, `mission`, `vision`) VALUES 
(1, 'دار علي بن زيد للطباعة والنشر مؤسسة جزائرية متخصصة في نشر الكتب الأكاديمية والثقافية، تأسست عام 2004 بمدينة بسكرة.', 'نشر المعرفة وإثراء المكتبة العربية وتشجيع الباحثين والمؤلفين.', 'أن نكون المرجع الأول للنشر الأكاديمي في الجزائر والمغرب العربي.')
ON DUPLICATE KEY UPDATE `main_text`=VALUES(`main_text`), `mission`=VALUES(`mission`), `vision`=VALUES(`vision`);

INSERT INTO `admins` (`id`, `username`, `password_hash`) VALUES 
(1, 'admin', 'assater123')
ON DUPLICATE KEY UPDATE `password_hash`=VALUES(`password_hash`);

INSERT INTO `categories` (`id`, `name`, `color`, `created_at`) VALUES 
(1, 'أدب وشعر', '#1B6CA8', '2026-06-12 21:32:50'),
(2, 'علوم وتقنية', '#27AE60', '2026-06-12 21:32:50'),
(3, 'تاريخ وحضارة', '#8E44AD', '2026-06-12 21:32:50'),
(4, 'دين وفقه', '#C0392B', '2026-06-12 21:32:50'),
(5, 'أطفال', '#F39C12', '2026-06-12 21:32:50')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `color`=VALUES(`color`);

INSERT INTO `books` (`id`, `title`, `author`, `description`, `cover_url`, `pdf_url`, `year`, `pages`, `color`, `status`, `category_id`, `created_at`) VALUES 
(1, 'كشافة بسكرة .. مسيرة نضال', 'عبد القادر الصيد', 'وترجع نواة هذا الكتاب إلى محاضرة عن تاريخ الكشافة الإسلامية ببسكرة ألقيتها في ملتقى الجمعية الخلدونية سنة 2013م بمتحف المجاهد بسكرة، وكان مصدرها معلومات قيمة زودني بها آنذاك القائد الكشفي طالب أحمد عبد الغني (فريد)، ثم بعد ذلك التقيت بالقائد الكشفي الطاهر لقصوري رحمه الله، وهو موسوعة في هذا المجال، فتح أمامي أفقا واسعا للمسيرة الكشفية في المنطقة، ثم التقيت بالقائد الكشفي بوزيد نوبلي رفقة القائد لزهر جزار رحمة الله عليه، وبرمجا لي بسرعة خاطفة لقاء مع القائد بشير سلمية رحمة الله عليه، إلى أن انغمست بكل وجداني في الموضوع.', 'https://daralibenzid.dz/photos/Screenshot%202026-06-12%20184913.png', 'https://daralibenzid.dz/pdf/%D9%83%D8%AA%D8%A7%D8%A8%20%D8%A7%D9%84%D9%83%D8%B4%D8%A7%D9%81%D8%A9%20%D9%86%D9%87%D8%A7%D8%A6%D9%8A.pdf', 2026, 515, '#1b6ca8', 'published', 1, '2026-06-12 21:43:03'),
(2, 'المسؤول والقائد العام للمنطقة الثانية بالولاية الأولى التاريخية المجاهد الرائد هلايلي محمد الصغير - محاضرات - رسائل - ردود - لقاءات صحفية - مظلمة الأوراس', 'بادي مكي بن عبد القادر', 'يحتوي هذا الكتاب على محاضرات ، رئسائل ودراسات ولقاءات صحفية ألقت الضوء على شخصية تاريخية وهي شخصية المجاهد الرائد هلايلي محمد الصغير المسؤول والقائد العام للمنطقة الثانية للولاية الأولى التاريخية', 'https://daralibenzid.dz/photos/%D8%A7%D9%84%D8%BA%D9%84%D8%A7%D9%81%20%D9%86%D9%87%D8%A7%D8%A6%D9%8A.jpg', 'https://daralibenzid.dz/pdf/%D8%A7%D9%84%D9%85%D8%AC%D8%A7%D9%87%D8%AF%20%D9%87%D9%84%D8%A7%D9%8A%D9%84%D9%8A%20%D9%85%D8%AD%D9%85%D8%AF%20%D8%A7%D9%84%D8%B5%D8%BA%D9%8A%D8%B1%20-%20%D8%A8%D8%A7%D8%AF%D9%8A%20%D9%85%D9%83%D9%8A%20-%20%D8%A7%D9%84%D9%86%D8%B3%D8%AE%D8%A9%20%D8%A7%D9%84%D8%A3%D8%AE%D9%8A%D8%B1%D8%A9.pdf', 2026, 248, '#88252a', 'draft', 3, '2026-06-13 03:55:26'),
(3, 'مع الرواية الجزائرية في تألقها الجديد', 'عبد الله لالي', 'يتطرق هذا الكتاب إلى الرواية الجزائرية الحديثة كتبها أدباء شباب طامح إلى ابراز معالم الرواية الجزائرية ضمن آليات الرواية العربية حيث عرفت تألقا راقيا', 'https://daralibenzid.dz/photos/Screenshot%202026-06-16%20150957.png', 'https://daralibenzid.dz/pdf/%D8%A7%D9%84%D8%B1%D9%88%D8%A7%D9%8A%D8%A9%20%D8%A7%D9%84%D8%AC%D8%B2%D8%A7%D8%A6%D8%B1%D9%8A%D8%A9%20222%D9%81%D9%8A%20%D8%AA%D8%A3%D9%84%D9%82%D9%87%D8%A7%20%D8%A7%D9%84%D8%AC%D8%AF%D9%8A%D8%AF.pdf', 2026, 206, '#1b6ca8', 'published', 1, '2026-06-16 14:17:58'),
(4, 'همس الهمس ( الطبعة الثانية )', 'محمد الكامل بن زيد', 'همس الهمس..أو تينهنان " السمراء التي توحدت فيها مجاميع الجمال الرّباني" ؛ هي وجه صحراء الطاسيلي السّاحر ، وأسطورتها الآسرة التي تحكي تجذر الإنسان التارقي في أرضه الغارقة في دفق الجمال التاريخي..\n\nفي هذه الرواية المتميّزة يبحر بنا محمّد الكامل بن زيد في عوالم الدهشة وآفاق الرؤى الحالمة، التي تمزج بين الفلسفة والأسطورة والصور الفنيّة المذهلة، بأسلوب أقل ما يقال فيه أنّه أسلوب غير عادي، أسلوب يشدّك إلى عبارته وصوره ويفرض عليك غوصا جميلا في المعاني المستترة ، والطرح العميق.\nتتحدّث الرواية - بتقنيات فنيّة مركبة تركيبا معقدا إلى حدّ ما – عن قصّة التفجير النووي الأوّل الذي أجراه الاحتلال الفرنسي في صحراء الجزائر 13 / 02 / عام 1960 م ، واصفة بشاعة التدمير الهائل الذي خلفه والمأساة الكبيرة الذي تركها في قلوب سكان المنطقة ، وقلوب كلّ الجزائريين ، وفي استرجاع للصور الماضية يتداخل التاريخ مع الحاضر والخيال مع الواقع ، لتحضر الملكة تينهنان[2]، ملكة الطاسيلي والطوارق التي طار اسمها في الآفاق ؛ تحضر مجسدة في صورة طفلة صغيرة هي ابنة الشيخ أمود ، الذي يحمل بدوره اسما لشخصيّة تاريخيّة معروفة قادت الطوارق في ثورة عظيمة ضدّ المحتلّ الفرنسي، الشيخ أمود وابنته تينهنان الصغيرة يلتقيان بسجينين فاريّن من قبضة المستعمر الفرنسي، ليكونا شاهدين على التفجير النووي الكبير في منطقة رقان. \nوتنتهي الرواية بإدانة إنسانية صارخة للمحتل الفرنسي ، الذي كان سببا في قبر حبّ مستحيل مات قبل أن يولد:\n (... حين دارت الرّاحلة قرب الخيمة اكتفت بأن ألقت بابتسامة عصماء إليّ تحمل حنانا فياضا أكبر مما تخيّلت ...ثمّ همست بهمس الهمس:\n-  وداعا يا حبّي الذي لم يبدأ بعد..)', 'https://daralibenzid.dz/photos/12615629_1721821574719609_7689456988256814402_o.jpg', 'https://daralibenzid.dz/pdf/%D9%87%D9%85%D8%B3%20%D8%A7%D9%84%D9%87%D9%85%D8%B3.pdf', 2000, 81, '#1b6ca8', 'published', 1, '2026-06-17 09:29:00'),
(5, 'بيوت صغيرة .. نوافذ كبيرة', 'محمد الكامل بن زيد', NULL, 'https://daralibenzid.dz/photos/74591090_663949650679120_9084961424341467136_n.jpg', 'https://daralibenzid.dz/pdf/%D9%85%D8%AD%D9%85%D8%AF%20%D8%A7%D9%84%D9%83%D8%A7%D9%85%D9%84%20%D8%A8%D9%86%20%D8%B2%D9%8A%D8%AF%20%D8%A8%D9%8A%D9%88%D8%AA%20%D8%B5%D8%BA%D9%8A%D8%B1%D8%A9%201.pdf', 2018, 84, '#175482', 'published', 1, '2026-06-17 09:47:27'),
(6, 'حتى يراك العالم', 'محمد الكامل بن زيد', NULL, 'https://daralibenzid.dz/photos/266301862_604240217317652_7211500770855644858_n.jpg', 'https://daralibenzid.dz/pdf/%D9%85%D8%AC%D9%85%D9%88%D8%B9%D8%A9%20%D8%AD%D8%AA%D9%89%20%D9%8A%D8%B1%D8%A7%D9%83%20%D8%A7%D9%84%D8%B9%D8%A7%D9%84%D9%85%20%D9%85%D8%B1%D8%B3%D9%84%D8%A9%20%D8%A7%D9%84%D9%89%20%D8%A7%D9%84%D8%A3%D8%B3%D8%AA%D8%A7%D8%B0%20%D8%B9%D9%8A%D8%B3%D9%89%20%D9%85%D8%A7%D8%B1%D9%88%D9%83.pdf', 2021, 79, '#1b6ca8', 'published', 1, '2026-06-17 09:50:17')
ON DUPLICATE KEY UPDATE `title`=VALUES(`title`), `author`=VALUES(`author`), `description`=VALUES(`description`);

INSERT INTO `contact` (`id`, `address`, `phone`, `email`, `hours`, `facebook`, `instagram`, `whatsapp`, `phone2`) VALUES 
(1, 'الجزائر، بسكرة', '+213 770 92 14 26', 'bnouelkamel@yahoo.fr', 'الأحد - الخميس: 8:00 - 16:00', 'https://facebook.com/daralibenzid', 'https://instagram.com/daralibenzid', '213770921426', '+213 6 61 75 27 28')
ON DUPLICATE KEY UPDATE `address`=VALUES(`address`), `phone`=VALUES(`phone`), `email`=VALUES(`email`);

INSERT INTO `messages` (`id`, `name`, `email`, `subject`, `message`, `is_read`, `created_at`) VALUES 
(1, 'رسالة ترحيبية', 'info@daralibenzid.dz', 'الاستفسار عن إصدار', 'مرحباً بكم في دار علي بن زيد للطباعة والنشر', 1, '2026-06-13 01:18:03')
ON DUPLICATE KEY UPDATE `message`=VALUES(`message`);

INSERT INTO `milestones` (`id`, `year`, `title`, `description`) VALUES 
(1, 2004, 'تأسيس الدار', 'تأسست دار علي بن زيد للطباعة والنشر بمدينة بسكرة لنشر المعرفة وتشجيع الباحثين الجزائريين.')
ON DUPLICATE KEY UPDATE `title`=VALUES(`title`), `description`=VALUES(`description`);

INSERT INTO `settings` (`id`, `hero_title`, `hero_subtitle`, `stat_years`, `stat_books`, `stat_readers`, `copyright`) VALUES 
(1, 'نشر المعرفة... إرث يدوم', 'دار علي بن زيد للطباعة والنشر', '22', '400', '5000', '© 2026 دار علي بن زيد للطباعة والنشر')
ON DUPLICATE KEY UPDATE `hero_title`=VALUES(`hero_title`), `hero_subtitle`=VALUES(`hero_subtitle`);

INSERT INTO `testimonials` (`id`, `name`, `role`, `content`, `quote`, `rating`) VALUES 
(1, 'أ.د. عبد القادر الصيد', 'باحث ومؤلف', 'تجربة ممتازة في النشر والطباعة مع دار علي بن زيد، احترافية عالية واهتمام بأدق التفاصيل.', 'تجربة ممتازة في النشر والطباعة مع دار علي بن زيد، احترافية عالية واهتمام بأدق التفاصيل.', 5)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `quote`=VALUES(`quote`);

-- ======================
-- Final Settings
-- ======================

SET FOREIGN_KEY_CHECKS=1;