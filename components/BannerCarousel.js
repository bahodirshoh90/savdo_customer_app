/**
 * Banner Carousel Component for Customer App
 * Rotates through advertisement banners every 2 seconds
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Colors from '../constants/colors';

// Banner aspect ratio: tepa va pastga kattalashtirilgan (16:5).
const BANNER_ASPECT_RATIO = 16 / 12; // 16:5 – banner balandrog'i oshirilgan
const DEFAULT_ROTATION_INTERVAL = 3000; // 3 seconds default

export default function BannerCarousel({ banners = [], onBannerPress, rotationInterval }) {
  const { width: screenWidth } = useWindowDimensions();
  const PADDING = 24; // 12px har tomonda – banner kengroq
  const BANNER_WIDTH = screenWidth - PADDING;
  const BANNER_HEIGHT = Math.round(BANNER_WIDTH / BANNER_ASPECT_RATIO);

  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef(null);
  const intervalRef = useRef(null);

  // Use rotation_interval from first banner or prop, or default
  const interval = rotationInterval || (banners.length > 0 && banners[0].rotation_interval) || DEFAULT_ROTATION_INTERVAL;

  useEffect(() => {
    if (banners.length <= 1) return;

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Auto-rotate banners
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % banners.length;
        
        // Scroll to next banner
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({
            x: nextIndex * BANNER_WIDTH,
            animated: true,
          });
        }
        
        return nextIndex;
      });
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [banners.length, interval]);

  const handleScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / BANNER_WIDTH);
    setCurrentIndex(index);
  };

  const handleBannerPress = (banner) => {
    if (onBannerPress) {
      onBannerPress(banner);
    }
  };

  if (!banners || banners.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, { width: BANNER_WIDTH, height: BANNER_HEIGHT }]}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
          snapToInterval={BANNER_WIDTH}
          snapToAlignment="start"
        >
          {banners.map((banner, index) => (
            <TouchableOpacity
              key={banner.id || index}
              style={{ width: BANNER_WIDTH, height: BANNER_HEIGHT }}
              onPress={() => handleBannerPress(banner)}
              activeOpacity={0.95}
            >
              <View style={styles.bannerImageWrapper}>
                <Image
                  source={{ uri: banner.image_url || banner.image }}
                  style={styles.bannerImage}
                  resizeMode="contain"
                  onError={(error) => {
                    console.warn('Banner image failed to load:', {
                      bannerId: banner.id,
                      imageUrl: banner.image_url,
                      error: error.nativeEvent?.error || error
                    });
                  }}
                  onLoad={() => {}}
                />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Dots indicator - Enhanced */}
        {banners.length > 1 && (
          <View style={styles.dotsContainer}>
            {banners.map((_, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  setCurrentIndex(index);
                  if (scrollViewRef.current) {
                    scrollViewRef.current.scrollTo({
                      x: index * BANNER_WIDTH,
                      animated: true,
                    });
                  }
                }}
                style={styles.dotWrapper}
              >
                <View
                  style={[
                    styles.dot,
                    index === currentIndex && styles.activeDot,
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: Colors.background,
  },
  container: {
    // width and height are set dynamically via inline style
    backgroundColor: Colors.borderLight,
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: Colors.shadow || '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
    }),
  },
  bannerImageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.08)', // contain uchun bo'sh joylarda yumshoq fon
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dotWrapper: {
    padding: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    transition: 'all 0.3s ease',
  },
  activeDot: {
    backgroundColor: Colors.surface || '#fff',
    width: 28,
    height: 8,
    borderRadius: 4,
  },
});
