import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Animated, Platform, TouchableWithoutFeedback } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';

const PRIMARY_COLOR = '#4A90E2';
const DANGER_COLOR = '#E74C3C';
const SECONDARY_DARK = 'rgba(255, 255, 255, 0.12)';
const SECONDARY_LIGHT = 'rgba(74, 144, 226, 0.12)';

const getButtonColors = (variant, isDarkMode) => {
  switch (variant) {
    case 'danger':
      return {
        backgroundColor: DANGER_COLOR,
        textColor: '#ffffff',
      };
    case 'secondary':
      return {
        backgroundColor: isDarkMode ? SECONDARY_DARK : SECONDARY_LIGHT,
        textColor: PRIMARY_COLOR,
        borderColor: PRIMARY_COLOR,
      };
    default:
      return {
        backgroundColor: PRIMARY_COLOR,
        textColor: '#ffffff',
      };
  }
};

const ConfirmationDialog = ({
  visible,
  title,
  message,
  buttons = [],
  onResult,
  dismissible = true,
}) => {
  const { isDarkMode } = useTheme();
  const [shouldRender, setShouldRender] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 18,
          stiffness: 180,
          mass: 0.9,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.92,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setShouldRender(false);
        }
      });
    }
  }, [visible, backdropOpacity, scaleAnim]);

  const handleDismiss = (value = null) => {
    if (onResult) {
      onResult(value);
    }
  };

  if (!shouldRender) {
    return null;
  }

  const resolvedButtons = buttons.length > 0 ? buttons : [{ text: 'OK', variant: 'primary', value: 0 }];

  return (
    <Modal
      transparent
      visible={shouldRender}
      animationType="none"
      statusBarTranslucent
    >
      <TouchableWithoutFeedback
        disabled={!dismissible}
        onPress={() => dismissible && handleDismiss(null)}
      >
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        />
      </TouchableWithoutFeedback>

      <View style={styles.centerContainer} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.dialogContainer,
            {
              backgroundColor: isDarkMode ? '#16181D' : '#ffffff',
              shadowColor: isDarkMode ? '#000000' : '#4A90E2',
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={[styles.iconWrapper, { backgroundColor: PRIMARY_COLOR }]}> 
            <MaterialIcons name="info" size={20} color="#ffffff" />
          </View>

          <Text
            style={[styles.title, { color: isDarkMode ? '#ffffff' : '#1A1A1A' }]}
          >
            {title || 'Notification'}
          </Text>

          {message ? (
            <Text
              style={[styles.message, { color: isDarkMode ? 'rgba(255,255,255,0.75)' : 'rgba(26,26,26,0.75)' }]}
            >
              {message}
            </Text>
          ) : null}

          <View style={styles.buttonsRow}>
            {resolvedButtons.map((btn, index) => {
              const { backgroundColor, textColor, borderColor } = getButtonColors(btn.variant, isDarkMode);
              return (
                <TouchableOpacity
                  key={`${btn.text}-${index}`}
                  style={[
                    styles.button,
                    {
                      backgroundColor,
                      borderColor: borderColor || 'transparent',
                      borderWidth: borderColor ? 1 : 0,
                      flex: resolvedButtons.length === 1 ? 1 : undefined,
                    },
                    index > 0 && resolvedButtons.length > 1 ? styles.buttonMargin : null,
                  ]}
                  activeOpacity={0.85}
                  onPress={() => handleDismiss(btn.value ?? index)}
                >
                  <Text style={[styles.buttonText, { color: textColor }]}>
                    {btn.text || 'OK'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  dialogContainer: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    paddingVertical: 24,
    paddingHorizontal: 24,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    minWidth: 100,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonMargin: {
    marginLeft: 10,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ConfirmationDialog;
