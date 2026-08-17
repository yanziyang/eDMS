<?php

$metadata['urn:edms:saml'] = [
    'AssertionConsumerService' => [
        [
            'Binding' => 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
            'Location' => 'http://localhost:5080/api/v1/auth/sso/saml/acs',
            'index' => 0,
            'isDefault' => true,
        ],
    ],
];
