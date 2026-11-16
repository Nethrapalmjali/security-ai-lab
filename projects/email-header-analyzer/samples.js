export const SAMPLES = {
legit: `Received: from mail-sor-f41.google.com (mail-sor-f41.google.com [209.85.220.41])
 by mx.example.org with ESMTPS id abc123
 for <me@example.org>; Mon, 16 Nov 2026 10:00:05 +0000
Received: from [192.168.1.20] (host.local [192.168.1.20])
 by smtp.gmail.com with ESMTPSA id xyz
 for <me@example.org>; Mon, 16 Nov 2026 10:00:02 +0000
Authentication-Results: mx.example.org;
 dkim=pass header.d=gmail.com header.s=20230601;
 spf=pass smtp.mailfrom=alice@gmail.com;
 dmarc=pass header.from=gmail.com
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=gmail.com; s=20230601; h=from:to:subject:date; bh=abc; b=def
Return-Path: <alice@gmail.com>
From: Alice <alice@gmail.com>
To: me@example.org
Message-ID: <CAK123@mail.gmail.com>
Subject: Lunch?
Date: Mon, 16 Nov 2026 10:00:00 +0000
`,
phish: `Received: from unknown (HELO mail.cheap-host.test) (203.0.113.77)
 by mx.example.org with SMTP; Mon, 16 Nov 2026 03:12:44 +0000
Authentication-Results: mx.example.org;
 spf=fail smtp.mailfrom=bounce@cheap-host.test;
 dkim=none;
 dmarc=fail header.from=paypa1-alerts.test
Return-Path: <bounce@cheap-host.test>
From: "security@paypal.com" <support@paypa1-alerts.test>
Reply-To: <recovery.desk@mail-secure.test>
To: victim@example.org
Subject: Your account is limited - verify now
Date: Mon, 16 Nov 2026 03:12:40 +0000
X-Mailer: PHPMailer 5.2
`,
forged: `Received: from relay2.example.net (relay2.example.net [198.51.100.5])
 by mx.example.org with ESMTP; Mon, 16 Nov 2026 09:00:00 +0000
Received: from relay1.example.net (relay1.example.net [198.51.100.4])
 by relay2.example.net with ESMTP; Mon, 16 Nov 2026 11:30:00 +0000
Received: from client (client [198.51.100.3])
 by relay1.example.net with ESMTP; Mon, 16 Nov 2026 11:29:00 +0000
From: Carol <carol@example.net>
Message-ID: <1@example.net>
Subject: weird timing
`
};
