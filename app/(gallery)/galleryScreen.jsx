import React, { useState, useEffect } from 'react';
import { View, FlatList, TouchableOpacity, Image, StyleSheet, Modal, Text } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Video } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function VideoGalleryScreen() {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [status, setStatus] = useState({});
  const [isFullScreen, setIsFullScreen] = useState(false);
  const insets = useSafeAreaInsets(); // Access the safe area insets

  // Fetch all videos from the album "Mini-When-Videos"
  useEffect(() => {
    (async () => {
      const album = await MediaLibrary.getAlbumAsync('mini-when-videos');
      if (album) {
        const media = await MediaLibrary.getAssetsAsync({
          album: album.id,
          mediaType: 'video',
          sortBy: 'creationTime',
        });
        setVideos(media.assets);
      } else {
        console.log('Album not found');
      }
    })();
  }, []);

  // Render each video thumbnail
  const renderVideoItem = ({ item }) => {
    return (
      <TouchableOpacity 
        style={styles.videoItem} 
        onPress={() => {
          setSelectedVideo(item.uri);
          setIsFullScreen(true);
        }}
      >
        <Image
          source={{ uri: item.uri }}
          style={styles.thumbnail}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <FlatList
        data={videos}
        keyExtractor={(item) => item.id}
        renderItem={renderVideoItem}
        numColumns={2}
        contentContainerStyle={styles.gallery}
        showsVerticalScrollIndicator={false}
      />

      {/* Modal for Full-Screen Video Playback */}
      <Modal
        visible={isFullScreen}
        animationType="slide"
        onRequestClose={() => setIsFullScreen(false)}
      >
        <View style={styles.videoContainer}>
          <Video
            style={styles.fullscreenVideo}
            source={{
              uri: selectedVideo,
            }}
            useNativeControls
            isLooping
            onPlaybackStatusUpdate={status => setStatus(() => status)}
            resizeMode="contain"
            shouldPlay
          />
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setIsFullScreen(false)}
          >
            <Text>X</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 10,
  },
  videoItem: {
    flex: 1,
    margin: 10,
    backgroundColor: '#000',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  thumbnail: {
    width: '100%',
    height: 200, // Adjusted height for better proportions
    borderRadius: 10,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenVideo: {
    width: '100%',
    height: '100%',
  },
  gallery: {
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50, // Place the close button at the top
    right: 20,
    zIndex: 10,
  },
  closeIcon: {
    width: 30,
    height: 30,
    tintColor: '#fff',
  },
});
