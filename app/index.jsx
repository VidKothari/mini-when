import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { usePermissions, createAlbumAsync, createAssetAsync, addAssetsToAlbumAsync, getAlbumAsync, requestPermissionsAsync } from 'expo-media-library';
import { FFmpegKit, FFmpegKitConfig, ReturnCode, FFprobeKit } from 'ffmpeg-kit-react-native';
import * as FileSystem from 'expo-file-system';
import Button from '../components/Button';
import { useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { enableScreens } from 'react-native-screens';

export default function App() {
    const [isReady, setIsReady] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
    const [mediaLibraryPermissionResponse, requestMediaLibraryPermission] = usePermissions(writeStatus = true);
    const [cameraProps, setCameraProps] = useState({
        facing: 'front',
        mode: 'video',
        mute: true
    });
    const [uri, setURI] = useState(null);
    const video = useRef(null);
    const [status, setStatus] = useState({});
    const router = useRouter();
    const cameraRef = useRef(null);

    enableScreens();

    useEffect(() => {
        SplashScreen.preventAutoHideAsync();

        (async () => {
            try {
                await requestCameraPermission();
                await requestMicrophonePermission();
                await requestPermissionsAsync();

                // Initialize FFmpegKit
                await FFmpegKitConfig.init();

                setIsReady(true);
                SplashScreen.hideAsync();
            } catch (error) {
                console.error('Error initializing app:', error);
            }
        })();
    }, []);

    if (!cameraPermission?.granted || !microphonePermission?.granted || mediaLibraryPermissionResponse?.status !== 'granted') {
        return (
            <View style={styles.container}>
                <Text>We need camera, microphone, and gallery permissions to continue.</Text>
                <TouchableOpacity
                    style={styles.button}
                    onPress={() => {
                        requestCameraPermission();
                        requestMicrophonePermission();
                        requestMediaLibraryPermission();
                    }}
                >
                    <Text style={styles.buttonText}>Grant Permissions</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const takeVideo = async () => {
        if (cameraRef.current && !isRecording) {
            try {
                setIsRecording(true);
                const videoPromise = cameraRef.current.recordAsync();
                setTimeout(async () => {
                    if (cameraRef.current) {
                        await cameraRef.current.stopRecording();
                        setIsRecording(false);
                    }
                }, 2000);

                const video = await videoPromise;
                await processVideo(video.uri);
            } catch (err) {
                console.log('Error while recording the video:', err);
                setIsRecording(false);
            }
        } else {
            if (cameraRef.current) {
                await cameraRef.current.stopRecording();
                setIsRecording(false);
            }
        }
    };

    const processVideo = async (videoUri) => {
        setIsProcessing(true);
        const tempDir = FileSystem.cacheDirectory + 'temp/';
        const originalVideo = tempDir + 'original.mp4';
        const reversedVideo = tempDir + 'reversed.mp4';
        const outputVideo = tempDir + 'boomerang.mp4';

        try {
            // Ensure temp directory exists
            await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });

            // Delete existing files if they exist
            await FileSystem.deleteAsync(originalVideo, { idempotent: true });
            await FileSystem.deleteAsync(reversedVideo, { idempotent: true });
            await FileSystem.deleteAsync(outputVideo, { idempotent: true });

            // Copy the new video
            await FileSystem.copyAsync({ from: videoUri, to: originalVideo });

            // Check if the original video has an audio stream
            const probeResult = await FFprobeKit.execute(`-i ${originalVideo} -show_streams -select_streams a -loglevel error`);
            const probeOutput = await probeResult.getOutput();
            const hasAudio = probeOutput.length > 0;

            console.log('Original video has audio:', hasAudio);

            // Adjust the reverse command based on whether there's audio
            let reverseCommand;
            if (hasAudio) {
                reverseCommand = `-y -i ${originalVideo} -vf reverse -af areverse ${reversedVideo}`;
            } else {
                reverseCommand = `-y -i ${originalVideo} -vf reverse ${reversedVideo}`;
            }

            console.log('Executing reverse command:', reverseCommand);
            const reverseSession = await FFmpegKit.execute(reverseCommand);
            const reverseReturnCode = await reverseSession.getReturnCode();

            if (ReturnCode.isSuccess(reverseReturnCode)) {
                console.log('Video reversal completed successfully');
            } else {
                console.error('Error reversing video:', await reverseSession.getFailStackTrace());
                throw new Error('Failed to reverse video');
            }

            // Adjust the concatenation command based on whether there's audio
            let concatCommand;
            if (hasAudio) {
                concatCommand = `-y -i ${originalVideo} -i ${reversedVideo} -filter_complex "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[outv][outa]" -map "[outv]" -map "[outa]" ${outputVideo}`;
            } else {
                concatCommand = `-y -i ${originalVideo} -i ${reversedVideo} -filter_complex "[0:v][1:v]concat=n=2:v=1[outv]" -map "[outv]" ${outputVideo}`;
            }

            console.log('Executing concat command:', concatCommand);
            const concatSession = await FFmpegKit.execute(concatCommand);
            const concatReturnCode = await concatSession.getReturnCode();
            const concatOutput = await concatSession.getOutput();

            console.log('Concat FFmpeg output:', concatOutput);

            if (ReturnCode.isSuccess(concatReturnCode)) {
                console.log('Video concatenation completed successfully');
                const outputExists = await FileSystem.getInfoAsync(outputVideo);
                console.log('Output video exists:', outputExists.exists);
                if (outputExists.exists) {
                    setURI(outputVideo);
                } else {
                    throw new Error('Output video file not found');
                }
            } else {
                console.error('Error concatenating videos:', await concatSession.getFailStackTrace());
                throw new Error('Failed to concatenate videos');
            }
        } catch (error) {
            console.error('Error processing video:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    const saveVideoToAlbum = async (uri) => {
        try {
            const asset = await createAssetAsync(uri);
            await createAlbumAsync('mini-when-videos', asset, true);

            Alert.alert(
                'Video Saved',
                'Your video has been successfully saved to the album!',
                [{ text: 'OK', onPress: () => console.log('OK Pressed') }]
            );

            console.log('Video saved to album successfully');
        } catch (error) {
            console.error('Error saving video to album:', error);
        }
    };

    const toggleProperty = (prop, option1, option2) => {
        setCameraProps((current) => ({
            ...current,
            [prop]: current[prop] === option1 ? option2 : option1
        }));
    };

    return (
        <SafeAreaProvider>
            <SafeAreaView style={styles.container}>
                {isProcessing ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#0000ff" />
                        <Text>Processing video...</Text>
                    </View>
                ) : !uri ? (
                    <>
                        <CameraView
                            style={styles.camera}
                            zoom={cameraProps.zoom}
                            facing={cameraProps.facing}
                            flash={cameraProps.flash}
                            animateShutter={cameraProps.animateShutter}
                            enableTorch={cameraProps.enableTorch}
                            ref={cameraRef}
                            mode="video"
                            mute={cameraProps.mute}
                        />
                        <View style={styles.bottomControlsContainer}>
                            <Button
                                icon='video-library'
                                size={45}
                                style={{ height: 60 }}
                                onPress={() => router.push('/galleryScreen')}
                            />
                            <Button
                                icon={isRecording ? 'stop-circle' : 'play-circle'}
                                size={60}
                                style={{ height: 60 }}
                                onPress={takeVideo}
                            />
                            <Button
                                icon='flip-camera-ios'
                                onPress={() => toggleProperty('facing', 'front', 'back')}
                                size={45}
                            />
                        </View>
                    </>
                ) : (
                    <>
                        <View style={styles.container}>
                            <Video
                                ref={video}
                                style={styles.video}
                                source={{ uri: uri }}
                                useNativeControls
                                resizeMode={ResizeMode.COVER}
                                isLooping={true}
                                shouldPlay={true}
                                onPlaybackStatusUpdate={status => setStatus(() => status)}
                            />
                        </View>
                        <View style={styles.bottomControlsContainer}>
                            <Button
                                icon='check'
                                onPress={() => saveVideoToAlbum(uri)}
                            />
                            <Button
                                icon='flip-camera-android'
                                onPress={() => setURI(null)}
                            />
                        </View>
                    </>
                )}
            </SafeAreaView>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff'
    },
    button: {
        backgroundColor: 'blue',
        padding: 10,
        margin: 10,
        borderRadius: 5,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
    },
    camera: {
        flex: 1,
        width: '100%',
    },
    bottomControlsContainer: {
        height: 100,
        backgroundColor: 'black',
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    video: {
        alignSelf: 'center',
        width: '100%',
        height: '100%',
    },
    buttons: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
