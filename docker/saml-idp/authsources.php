<?php

$config = [
    'admin' => [
        'core:AdminPassword',
    ],
    'example-userpass' => [
        'exampleauth:UserPass',
        'student:studentpass' => [
            'uid' => ['student'],
            'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress' => ['student@edms.local'],
            'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name' => ['SAML Demo User'],
        ],
    ],
];
