import React from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Image,
  Text,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CollectionsHamburgerMenu = ({
  visible,
  onClose,
  menuAnim,
  translateX,
  statusBarHeight = 0,
  isDarkMode = false,
  accentColor = '#2F6BFF',
  profileImage,
  fallbackIcon = 'account-circle',
  headerTitle,
  headerSubtitle,
  sections = [],
  onSelectAction,
  footerTitle = 'LinksVault',
  versionLabel = '',
  footerIconName = 'shield',
  menuContentStyle,
  bodyStyle,
}) => {
  const [showFallbackAvatar, setShowFallbackAvatar] = React.useState(!profileImage);
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    setShowFallbackAvatar(!profileImage);
  }, [profileImage]);

  const backgroundColor = isDarkMode ? '#141414' : '#ffffff';
  const borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  const headerBackground = isDarkMode ? '#1C1C1C' : '#F5F7FA';
  const headerBorder = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  const closeBg = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.05)';
  const closeBorder = isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)';
  const textPrimary = isDarkMode ? '#ffffff' : '#0F172A';
  const textSecondary = isDarkMode ? 'rgba(255,255,255,0.65)' : 'rgba(15,23,42,0.6)';
  const footerBackground = isDarkMode ? '#14161B' : '#F5F7FA';
  const footerBorder = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.05)';
  const iconWrapperColor = 'rgba(47,107,255,0.18)';
  const resolvedStatusBarHeight = Math.max(statusBarHeight, insets.top);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.menuOverlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <View
          style={{
            width: '82%',
            maxWidth: 340,
            height: '100%',
            borderRadius: 28,
            borderBottomRightRadius: 0,
            overflow: 'hidden',
          }}
        >
          <Animated.View
            renderToHardwareTextureAndroid={true}
            style={[
              styles.menuContent,
              menuContentStyle,
              {
                backgroundColor,
                borderColor,
                paddingTop: resolvedStatusBarHeight,
                transform: [{ translateX }],
                opacity: menuAnim,
              },
            ]}
          >
          <View
            style={[
              styles.menuHeader,
              {
                backgroundColor: headerBackground,
                borderBottomColor: headerBorder,
              },
            ]}
          >
            <View style={styles.menuTitleContainer}>
              <View
                style={[
                  styles.menuProfileImage,
                  {
                    backgroundColor: isDarkMode
                      ? 'rgba(47,107,255,0.16)'
                      : 'rgba(47,107,255,0.12)',
                    borderColor: isDarkMode
                      ? 'rgba(47,107,255,0.4)'
                      : 'rgba(47,107,255,0.25)',
                  },
                ]}
              >
                {!showFallbackAvatar && profileImage ? (
                  <Image
                    source={{ uri: profileImage }}
                    style={styles.menuProfileImageInner}
                    resizeMode="cover"
                    onError={() => setShowFallbackAvatar(true)}
                  />
                ) : (
                  <View
                    style={[styles.menuProfileFallback, { backgroundColor: accentColor }]}
                  >
                    <MaterialIcons name={fallbackIcon} size={26} color="#ffffff" />
                  </View>
                )}
              </View>
              <View style={styles.menuHeaderTextGroup}>
                {headerTitle ? (
                  <Text style={[styles.menuGreeting, { color: textPrimary }]}>{headerTitle}</Text>
                ) : null}
                {headerSubtitle ? (
                  <Text style={[styles.menuSubGreeting, { color: textSecondary }]}>{headerSubtitle}</Text>
                ) : null}
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.menuCloseButton,
                {
                  backgroundColor: closeBg,
                  borderColor: closeBorder,
                },
              ]}
            >
              <MaterialIcons name="close" size={20} color={textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.menuBodyContainer}>
            <View
              style={[
                styles.menuBodyScroll,
                bodyStyle,
              ]}
            >
              {sections.map((section) => (
                <View key={section.title} style={styles.menuSection}>
                  <Text
                    style={[
                      styles.menuSectionTitle,
                      { color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(15,23,42,0.6)' },
                    ]}
                  >
                    {section.title}
                  </Text>
                  {section.items.map((item) => (
                    <TouchableOpacity
                      key={item.key}
                      style={styles.menuListItem}
                      activeOpacity={0.8}
                      onPress={() => onSelectAction?.(item.action)}
                    >
                      <View
                        style={[styles.menuIconWrapperBare, { backgroundColor: iconWrapperColor }]}
                      >
                        <MaterialIcons
                          name={item.icon}
                          size={21}
                          color={item.iconColor || accentColor}
                        />
                      </View>
                      <View style={styles.menuTextContainer}>
                        <Text
                          style={[styles.menuItemTitle, { color: textPrimary }]}
                        >
                          {item.title}
                        </Text>
                        {item.subtitle ? (
                          <Text
                            style={[
                              styles.menuItemSubtitle,
                              { color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' },
                            ]}
                          >
                            {item.subtitle}
                          </Text>
                        ) : null}
                      </View>
                      <MaterialIcons
                        name="chevron-right"
                        size={19}
                        color={isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          </View>

          <View
            style={[
              styles.menuFooter,
              {
                borderTopColor: footerBorder,
                backgroundColor: footerBackground,                
              },
            ]}
          >
            <View>
              <Text style={[styles.menuFooterTitle, { color: textPrimary }]}>{footerTitle}</Text>
              {versionLabel ? (
                <Text
                  style={[
                    styles.menuFooterSubtitle,
                    { color: isDarkMode ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.55)' },
                  ]}
                >
                  {versionLabel}
                </Text>
              ) : null}
            </View>
            <MaterialIcons name={footerIconName} size={19} color={accentColor} />
          </View>
        </Animated.View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  menuOverlay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuContent: {
    width: '100%',
    height: '100%',
    borderWidth: 1,
    shadowOffset: {
      width: -12,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 18,
    backfaceVisibility: 'hidden',
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  menuTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuProfileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  menuProfileImageInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  menuProfileFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuHeaderTextGroup: {
    marginLeft: 12,
    flex: 1,
  },
  menuGreeting: {
    fontSize: 17,
    fontWeight: '700',
  },
  menuSubGreeting: {
    fontSize: 12,
    marginTop: 2,
  },
  menuCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginLeft: 10,
  },
  menuBody: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'flex-start',
  },
  menuBodyContainer: {
    flex: 1,
  },
  menuBodyScroll: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    paddingBottom: 0,
  },
  menuSection: {
    marginBottom: 6,
  },
  menuSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.0,
    marginBottom: 5,
  },
  menuListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    marginBottom: 5,
  },
  menuIconWrapperBare: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  menuItemSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  menuFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  menuFooterTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  menuFooterSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
});

export default CollectionsHamburgerMenu;

