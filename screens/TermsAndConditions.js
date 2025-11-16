import React from 'react';
import { View, ScrollView, StyleSheet, Text, StatusBar, TouchableOpacity, Linking } from 'react-native';

const APP_NAME = 'LinksVault';
const TERMS_URL = 'https://yonatancarmeli.github.io/LinksVault/terms';

const sections = [
    {
        title: '1. Acceptance of Terms',
        content: [
            `By creating an account, accessing, or using ${APP_NAME} (the "Service"), you agree to be bound by these Terms & Conditions (the "Terms") and our Privacy Policy. If you do not agree, do not access or use the Service.`,
            'If you are using the Service on behalf of a company or other entity, you represent that you have authority to bind that entity to these Terms.'
        ]
    },
    {
        title: '2. Eligibility',
        content: [
            'You must be at least 13 years old (or older where required by local law) to use the Service.',
            'You may not use the Service if you have been previously suspended or removed.'
        ]
    },
    {
        title: '3. Account Responsibilities',
        content: [
            'You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account.',
            'Notify us immediately of any unauthorized use or security breach.',
            'You must provide accurate, current, and complete information when creating your account.'
        ]
    },
    {
        title: '4. Acceptable Use',
        content: [
            'You agree not to use the Service to store, share, or transmit content that is unlawful, abusive, defamatory, infringing, or otherwise objectionable.',
            'You may not interfere with or disrupt the integrity or performance of the Service, including introducing malware or attempting to access restricted areas.',
            'Automated access (scraping, crawling, or similar) is prohibited unless explicitly authorized.'
        ]
    },
    {
        title: '5. User Content',
        content: [
            'You retain ownership of the links, notes, and other content you store within the Service ("User Content").',
            `By submitting User Content, you grant ${APP_NAME} a limited, non-exclusive, worldwide, royalty-free license to host, display, and process the content solely for the purpose of operating and improving the Service.`,
            'You represent that you have the rights necessary to submit User Content and that it does not infringe the rights of any third party.'
        ]
    },
    {
        title: '6. Subscription & Payments',
        content: [
            'Certain features may be offered under paid plans. Pricing, billing cycles, and payment methods will be disclosed at the time of purchase.',
            'Unless otherwise stated, subscriptions renew automatically until cancelled.',
            'Trial offers, promotions, and discounts are subject to specific terms presented at sign-up.'
        ]
    },
    {
        title: '7. Third-Party Services',
        content: [
            'The Service may integrate with third-party products or services. Use of those services is subject to their own terms and policies.',
            `${APP_NAME} is not responsible for third-party content, availability, or data practices.`
        ]
    },
    {
        title: 'Affiliations & Trademarks',
        content: [
            `${APP_NAME} is an independent application and is not affiliated with, endorsed by, or sponsored by any of the social media platforms displayed within the app, including but not limited to Instagram, Facebook, YouTube, TikTok, Twitter/X, Reddit, Snapchat, or any other platforms.`,
            'All trademarks, service marks, logos, and brand names are the property of their respective owners. The use of these marks and logos is for identification and reference purposes only and does not imply any affiliation, endorsement, or sponsorship.'
        ]
    },
    {
        title: '8. Intellectual Property',
        content: [
            `${APP_NAME}, its logos, designs, and other marks are the property of LinksVault and may not be used without permission.`,
            'All software, code, and design elements of the Service are protected by intellectual property laws.'
        ]
    },
    {
        title: '9. Feedback',
        content: [
            'Any feedback, comments, or suggestions you provide may be used by us without restriction and without compensation to you.'
        ]
    },
    {
        title: '10. Termination',
        content: [
            'We may suspend or terminate your access to the Service if you violate these Terms or if we reasonably believe your use creates risk or liability.',
            'Upon termination, your right to use the Service ceases and certain provisions of these Terms will survive, including intellectual property, disclaimers, and liability limitations.'
        ]
    },
    {
        title: '11. Disclaimer of Warranties',
        content: [
            'The Service is provided "as is" and "as available" without warranties of any kind, express or implied.',
            'We do not warrant that the Service will be uninterrupted, secure, or error-free.'
        ]
    },
    {
        title: '12. Limitation of Liability',
        content: [
            'To the fullest extent permitted by law, LinksVault is not liable for indirect, incidental, special, consequential, or punitive damages, or for loss of profits, data, use, or goodwill.',
            'Our aggregate liability in connection with the Service will not exceed the amount you paid us (if any) in the twelve (12) months preceding the event giving rise to the claim.'
        ]
    },
    {
        title: '13. Indemnification',
        content: [
            'You agree to indemnify and hold harmless LinksVault, its affiliates, and their respective officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses arising out of your use of the Service or breach of these Terms.'
        ]
    },
    {
        title: '14. Changes to the Service',
        content: [
            'We may modify or discontinue the Service (or any feature) at any time, with or without notice.',
            'We are not liable if any part of the Service becomes unavailable at any time.'
        ]
    },
    {
        title: '15. Changes to These Terms',
        content: [
            'We may update these Terms from time to time. We will post the updated Terms with an effective date.',
            'Continued use after changes take effect constitutes acceptance of the updated Terms. If you do not agree, you must stop using the Service.'
        ]
    },
    {
        title: '16. Governing Law & Disputes',
        content: [
            'These Terms are governed by the laws of your local jurisdiction unless otherwise required by applicable law.',
            'Any disputes will be resolved first through informal negotiations, and if unresolved, through binding arbitration or the courts of competent jurisdiction, as permitted by law.'
        ]
    },
    {
        title: '17. Contact',
        content: [
            'Questions about these Terms can be sent to help.linksvault.app@gmail.com.'
        ]
    }
];

const TermsAndConditions = () => {
    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.heading}>Terms &amp; Conditions</Text>
                <Text style={styles.updated}>Last updated: {new Date().toLocaleDateString()}</Text>
                <Text style={styles.intro}>
                    These Terms &amp; Conditions describe your rights and responsibilities when using {APP_NAME}.
                    Please read them carefully.
                </Text>
                {sections.map((section) => (
                    <View key={section.title} style={styles.section}>
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                        {section.content.map((paragraph, index) => (
                            <Text key={index} style={styles.paragraph}>
                                {paragraph}
                            </Text>
                        ))}
                    </View>
                ))}
                <TouchableOpacity
                    onPress={() => Linking.openURL(TERMS_URL)}
                    activeOpacity={0.8}
                    style={styles.linkButton}
                >
                    <Text style={styles.linkButtonText}>Open Web Version</Text>
                </TouchableOpacity>
                <Text style={styles.paragraph}>
                    If you have any questions about these Terms, please reach out to us at help.linksvault.app@gmail.com.
                </Text>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A'
    },
    content: {
        paddingTop: (StatusBar.currentHeight || 0) + 24,
        paddingBottom: 48,
        paddingHorizontal: 20
    },
    heading: {
        fontSize: 28,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 8,
        textAlign: 'center'
    },
    updated: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        marginBottom: 24
    },
    intro: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.85)',
        lineHeight: 24,
        marginBottom: 24
    },
    section: {
        marginBottom: 24
    },
    sectionTitle: {
        fontSize: 18,
        color: '#38BDF8',
        fontWeight: '600',
        marginBottom: 8
    },
    paragraph: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.85)',
        lineHeight: 22,
        marginBottom: 10
    },
    linkButton: {
        marginTop: 8,
        backgroundColor: '#38BDF8',
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center'
    },
    linkButtonText: {
        color: '#0F172A',
        fontWeight: '700',
        fontSize: 14
    }
});

export default TermsAndConditions;


