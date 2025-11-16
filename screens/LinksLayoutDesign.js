import { StyleSheet } from 'react-native';

/**
 * Shared spacing, sizing, and positional tokens that mirror the link layout
 * implementations inside `MyLinks.js`. Keeping these values centralized makes
 * it easier to guarantee visual parity across screens (e.g. `CollectionFormat`
 * and `MyLinks`) without altering the original files yet.
 */

export const LINK_LAYOUT_CONSTANTS = {
  horizontalPadding: 16,
  gridColumnGap: 12,
};

/**
 * Returns the full set of per-design style snippets exactly as authored in
 * `MyLinks.js`. The only dynamic value is the computed `gridCardWidth`, which
 * depends on the caller's screen width.
 */
export const buildLinkDesignStyles = (screenWidth) => {
  const { horizontalPadding, gridColumnGap } = LINK_LAYOUT_CONSTANTS;
  const gridCardWidth =
    (screenWidth - horizontalPadding * 2 - gridColumnGap) / 2;

  return {
    classic: {
      linkItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: 'transparent',
        paddingVertical: 6,
        paddingLeft: 4,
        paddingRight: 12,
        borderRadius: 16,
        marginVertical: 4,
        borderWidth: 0,
        shadowOpacity: 0,
        elevation: 0,
        minHeight: 110,
      },
      previewContainer: {
        width: 132,
        borderRadius: 12,
        backgroundColor: '#e0e0e0',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
        marginLeft: 0,
        overflow: 'hidden',
        aspectRatio: 1,
        height: undefined,
        alignSelf: 'flex-start',
      },
      linkContent: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingVertical: 4,
        paddingRight: 0,
        rowGap: 4,
      },
      linkActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingLeft: 4,
        borderTopWidth: 0,
        borderTopColor: 'transparent',
        minHeight: 24,
        position: 'absolute',
        right: 12,
        bottom: 10,
      },
      linkTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 4,
        lineHeight: 20,
        flexShrink: 1,
        flexWrap: 'wrap',
        maxWidth: '100%',
      },
      linkUrl: {
        display: 'none',
      },
      linkDescription: {
        display: 'none',
      },
    },
    minimal: {
      linkItem: {
        backgroundColor: 'transparent',
        padding: 6,
        borderRadius: 12,
        marginVertical: 4,
        borderWidth: 0,
        borderColor: 'transparent',
        shadowOpacity: 0,
        elevation: 0,
      },
      previewContainer: {
        width: '100%',
        height: 150,
        borderRadius: 12,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        marginBottom: 6,
      },
      linkContent: {
        marginTop: 0,
        paddingTop: 0,
      },
      linkActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingTop: 6,
        borderTopWidth: 0,
        borderTopColor: 'transparent',
      },
      linkTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
        marginBottom: 4,
        lineHeight: 20,
      },
      linkUrl: {
        display: 'none',
      },
      linkDescription: {
        display: 'none',
      },
    },
    grid: {
      linkItem: {
        backgroundColor: 'transparent',
        padding: 2,
        borderRadius: 12,
        marginVertical: 4,
        borderWidth: 0,
        borderColor: 'transparent',
        shadowOpacity: 0,
        elevation: 0,
        width: gridCardWidth,
      },
      previewContainer: {
        width: '100%',
        height: 160,
        borderRadius: 12,
        backgroundColor: '#e0e0e0',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        marginBottom: 6,
      },
      linkContent: {
        marginTop: 0,
        paddingHorizontal: 0,
        width: '100%',
        paddingTop: 0,
      },
      linkActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 6,
        paddingHorizontal: 2,
        borderTopWidth: 0,
        borderTopColor: 'transparent',
      },
      linkTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
        width: '100%',
        textAlign: 'left',
        lineHeight: 18,
      },
      linkUrl: {
        display: 'none',
      },
      linkDescription: {
        display: 'none',
      },
    },
    modern: {
      linkItem: {
        backgroundColor: 'transparent',
        padding: 8,
        borderRadius: 14,
        marginVertical: 6,
        borderWidth: 0,
        borderColor: 'transparent',
        shadowOpacity: 0,
        elevation: 0,
      },
      previewContainer: {
        width: '100%',
        aspectRatio: 1,
        height: undefined,
        borderRadius: 12,
        backgroundColor: '#e0e0e0',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        shadowOpacity: 0,
        elevation: 0,
        marginBottom: 6,
      },
      linkContent: {
        marginTop: 0,
        paddingTop: 4,
      },
      linkActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingTop: 6,
        borderTopWidth: 0,
        borderTopColor: 'transparent',
      },
      linkTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
        lineHeight: 24,
      },
      linkUrl: {
        display: 'none',
      },
      linkDescription: {
        display: 'none',
      },
    },
  };
};

/**
 * Convenience helper when only a single design is needed.
 */
export const getLinkDesignStyles = (designKey, screenWidth) => {
  const designs = buildLinkDesignStyles(screenWidth);
  return designs[designKey] || designs.modern;
};

/**
 * Base styles that are shared across every design variant. These values are
 * copied verbatim from `MyLinks.js` to preserve identical spacing and sizing.
 */
export const sharedLinkLayoutStyles = StyleSheet.create({
  linksContainer: {
    marginTop: 10,
  },
  gridLinksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  linkCard: {
    borderRadius: 16,
    padding: 0,
    marginBottom: 12,
    borderWidth: 0,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  previewContainer: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    marginLeft: 0,
    overflow: 'hidden',
    aspectRatio: 1,
    height: undefined,
    alignSelf: 'flex-start',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  previewPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  previewLoading: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  siteNameBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  siteNameText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  retryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    borderWidth: 1,
    borderColor: '#4a90e2',
  },
  retryText: {
    color: '#4a90e2',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  linkContent: {
    flex: 1,
  },
  linkDate: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
});


