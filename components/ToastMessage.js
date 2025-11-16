import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Platform, Text, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const VARIANT_STYLES = {
  success: {
    backgroundColor: '#4CAF50',
    icon: 'check-circle',
  },
  error: {
    backgroundColor: '#F44336',
    icon: 'error',
  },
  info: {
    backgroundColor: '#2196F3',
    icon: 'info',
  },
};

const HIDDEN_TRANSLATE_Y = -80;

const ToastMessage = ({ visible, message, variant = 'success', topOffset }) => {
  const { width: windowWidth } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(HIDDEN_TRANSLATE_Y)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [shouldRender, setShouldRender] = useState(visible);

  useEffect(() => {
    if (visible && message) {
      setShouldRender(true);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 18,
          stiffness: 180,
          mass: 0.8,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: HIDDEN_TRANSLATE_Y,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setShouldRender(false);
        }
      });
    }
  }, [visible, message, opacity, translateY]);

  if (!shouldRender || !message) {
    return null;
  }

  const { backgroundColor, icon } =
    VARIANT_STYLES[variant] ?? VARIANT_STYLES.info;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          backgroundColor,
          opacity,
          transform: [{ translateY }],
          top: topOffset ?? (Platform.OS === 'ios' ? 60 : 40),
          left: 20,
          right: 20,
          width: windowWidth - 40,
        },
      ]}
    >
      <MaterialIcons name={icon} size={20} color="#ffffff" style={styles.icon} />
      <Text style={styles.text} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10000,
  },
  icon: {
    marginRight: 10,
  },
  text: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
});

export default ToastMessage;


