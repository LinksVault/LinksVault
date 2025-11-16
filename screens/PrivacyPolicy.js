import React from 'react';
import { View, ScrollView, StyleSheet, Text, StatusBar, TouchableOpacity, Linking } from 'react-native';

const APP_NAME = 'LinksVault';
const PRIVACY_POLICY_URL = 'https://yonatancarmeli.github.io/LinksVault/privacy-policy';

const privacySections = [
    {
        title: '1. Overview',
        content: [
            `This Privacy Policy explains how ${APP_NAME} ("we", "us", "our") collects, uses, discloses, and protects your information when you use our mobile or web applications, services, and associated websites (collectively, the "Service").`
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
        title: '2. Information We Collect',
        content: [
            '• Account Information: name, email address, authentication tokens, profile photo (if you choose to provide one).',
            '• Content You Add: links, tags, folders, notes, and metadata you store in the Service.',
            '• Usage Data: actions taken within the app, device type, app version, log files, crash reports, pages visited, and referral sources.',
            '• Device & Technical Data: IP address, operating system, device identifiers, and diagnostic data collected via third-party analytics tools.',
            '• Optional Data: preferences, feedback, survey responses, and support correspondence.'
        ]
    },
    {
        title: '3. How We Use Information',
        content: [
            '• Provide, maintain, and improve the Service.',
            '• Personalize your experience, such as remembering preferences and recommended content.',
            '• Process transactions, including subscriptions and in-app purchases.',
            '• Communicate with you about updates, security alerts, and support.',
            '• Monitor performance, diagnose technical issues, and conduct analytics.',
            '• Ensure compliance with legal obligations and enforce our Terms & Conditions.'
        ]
    },
    {
        title: '4. Legal Bases for Processing',
        content: [
            'If you reside in the European Economic Area (EEA), United Kingdom (UK), or Switzerland, we process Personal Data under these legal bases:',
            '• Contract: To deliver the Service you request.',
            '• Legitimate Interests: To maintain and improve the Service, prevent fraud, and protect users.',
            '• Consent: For optional features, marketing communications, and analytics where required.',
            '• Legal Obligation: To meet regulatory requirements and respond to lawful requests.'
        ]
    },
    {
        title: '5. How We Share Information',
        content: [
            '• Service Providers: trusted vendors who perform services on our behalf (hosting, analytics, payments, customer support).',
            '• Third-Party Integrations: only when you connect optional services (e.g., cloud storage, social platforms).',
            '• Legal Compliance: to comply with applicable law, regulation, legal process, or governmental request.',
            '• Business Transfers: in connection with a merger, acquisition, or sale of assets, subject to continued protection of your data.',
            'We do not sell your personal information.'
        ]
    },
    {
        title: '6. Data Retention',
        content: [
            'We retain information for as long as your account remains active or as needed to provide the Service. We may also retain certain information to comply with legal obligations, resolve disputes, and enforce agreements.',
            'If you delete your account, we will delete or anonymize your personal information within a reasonable timeframe, subject to legal requirements.'
        ]
    },
    {
        title: '7. Your Rights & Choices',
        content: [
            'Depending on your jurisdiction, you may have rights to access, correct, update, delete, or restrict processing of your personal information.',
            'You can update account information in-app or contact us to exercise data rights.',
            'For marketing communications, you can unsubscribe via the links in emails or adjust notification settings in the app.',
            'If we rely on consent to process data, you can withdraw consent at any time without affecting the lawfulness of processing carried out before withdrawal.'
        ]
    },
    {
        title: '8. International Data Transfers',
        content: [
            'We may store and process information in countries outside of your own. We take appropriate safeguards to protect your information, such as standard contractual clauses or other lawful transfer mechanisms.'
        ]
    },
    {
        title: '9. Children\'s Privacy',
        content: [
            'The Service is not directed to children under 13 (or the minimum age in your jurisdiction). We do not knowingly collect personal information from children. If we learn we have collected such information, we will delete it promptly.'
        ]
    },
    {
        title: '10. Security',
        content: [
            'We implement technical and organizational measures designed to protect your information against unauthorized access, alteration, disclosure, or destruction.',
            'Despite our efforts, no security measures are perfect and we cannot guarantee absolute security.'
        ]
    },
    {
        title: '11. Third-Party Links & Services',
        content: [
            'The Service may contain links to third-party websites or services. We are not responsible for the privacy practices of those third parties. We encourage you to review their policies.'
        ]
    },
    {
        title: '12. Updates to This Policy',
        content: [
            'We may update this Privacy Policy from time to time. We will notify you of material changes by updating the "Last updated" date and, where appropriate, providing additional notice.',
            'Your continued use of the Service after changes become effective constitutes acceptance of the updated policy.'
        ]
    },
    {
        title: '13. Contact',
        content: [
            'For questions, requests, or complaints about this Privacy Policy or our data practices, contact us at privacy@linksvault.app.'
        ]
    }
];

const PrivacyPolicy = () => {
    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.heading}>Privacy Policy</Text>
                <Text style={styles.updated}>Last updated: {new Date().toLocaleDateString()}</Text>
                <Text style={styles.intro}>
                    Your privacy matters to us. This policy outlines what information we collect, how we use it,
                    and the choices you have regarding your data when using {APP_NAME}.
                </Text>
                {privacySections.map((section) => (
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
                    onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
                    activeOpacity={0.8}
                    style={styles.linkButton}
                >
                    <Text style={styles.linkButtonText}>Open Web Version</Text>
                </TouchableOpacity>
                <Text style={styles.paragraph}>
                    If you have any concerns about how we handle your information, please reach out to privacy@linksvault.app.
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
    }
});

export default PrivacyPolicy;
