import React from 'react'
import PropTypes from 'prop-types'
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
  PermissionsAndroid,
  Modal,
  Pressable,
  Text
} from 'react-native'
import { launchCamera, launchImageLibrary } from 'react-native-image-picker'
import ImageResizer from 'react-native-image-resizer'
import RNFS from 'react-native-fs'

export default class PhotoUpload extends React.Component {
  static propTypes = {
    containerStyle: PropTypes.object,
    photoPickerTitle: PropTypes.string,
    maxHeight: PropTypes.number,
    maxWidth: PropTypes.number,
    format: PropTypes.string,
    quality: PropTypes.number,
    onPhotoSelect: PropTypes.func, // returns the base64 string of uploaded photo
    onError: PropTypes.func, // if any error occur with response
    onTapCustomButton: PropTypes.func, // on tap custom button
    onStart: PropTypes.func, // when user starts (useful for loading, etc)
    onCancel: PropTypes.func, // when user cancel
    onResponse: PropTypes.func, // on response exists!
    onRender: PropTypes.func, // after render
    onResizedImageUri: PropTypes.func, // when image resized is ready
    imagePickerProps: PropTypes.object // react-native-image-picker props
  }

  state = {
    maxHeight: this.props.height || 600,
    maxWidth: this.props.width || 600,
    format: this.props.format || 'JPEG',
    quality: this.props.quality || 100,
    buttonDisabled: false,
    modalVisible: false
  }

  options = {
    title: this.props.photoPickerTitle || 'Select Photo',
    storageOptions: {
      skipBackup: true,
      path: 'images'
    },
    ...this.props.imagePickerProps
  }

  closeModal = async () => {
    this.setState({ modalVisible: false });
  }

  openModal = async () => {
    this.setState({ modalVisible: true });
  }

  performLaunchAction = async (camera) => {
    this.setState({ buttonDisabled: true });
    if (this.props.onStart) this.props.onStart()

    // get image from image picker
    let launchFn = launchCamera;
    if(!camera) {
      launchFn = launchImageLibrary
    } else {
      // ask for android specific permissions
      if(Platform.OS === 'android') {
        // camera ask for permissions
        const cameraPermissionReceived = await requestCameraPermission();
        if(!cameraPermissionReceived) {
          console.log("Error: Trying to launch camera without camera permissions");
          if(this.props.onError) this.props.onError("Please provide camera permissions");
          return;
        }
      }
    }
    launchFn(this.options, async response => {
      try {
        this.setState({buttonDisabled: false})

        let rotation = 0 
        const {originalRotation} = response
        

        if (this.props.onResponse) this.props.onResponse(response)

        if (response.didCancel) {
          console.log('User cancelled image picker')
          if (this.props.onCancel) this.props.onCancel('User cancelled image picker')
          return
        } else if (response.error) {
          console.log('ImagePicker Error: ', response.error)
          if (this.props.onError) this.props.onError(response.error)
          return
        } else if (response.errorCode) {
          console.log('ImagePicker errorCode: ', response.errorCode)
          console.log('ImagePicker errorMessage: ', response.errorMessage)
          if (this.props.onError) this.props.onError(response.errorMessage)
          return
        } 
        else if (response.customButton) {
          console.log('User tapped custom button: ', response.customButton)
          if (this.props.onTapCustomButton) this.props.onTapCustomButton(response.customButton)
          return
        }

        let { maxHeight, maxWidth, quality, format } = this.state
        
        //Determining rotation param
        if ( originalRotation === 90) { 
          rotation = 90 
        } else if (originalRotation === 180) { 
          //For a few images rotation is 180. 
          rotation = -180 
        } else if ( originalRotation === 270 )  {
          //When taking images with the front camera (selfie), the rotation is 270.
          rotation = -90 
        }
        // resize image
        if(!response.assets || !response.assets.length) {
          console.log('no assets found in imagepicker response');
          if (this.props.onError) this.props.onError('no assets found in imagepicker response');
          return;
        }
        const [asset0] = response.assets; // FIXME: handles only 1 image
        const resizedImageUri = await ImageResizer.createResizedImage(
          asset0.uri, // `data:image/jpeg;base64,${response.data}`,
          maxHeight,
          maxWidth,
          format,
          quality,
          rotation
        )

        if (this.props.onResizedImageUri) this.props.onResizedImageUri(resizedImageUri)

        /*
        const filePath = Platform.OS === 'android' && resizedImageUri.uri.replace
          ? resizedImageUri.uri.replace('file:/data', '/data')
          : resizedImageUri.uri

        // convert image back to base64 string
        const photoData = await RNFS.readFile(filePath, 'base64')
        let source = { uri: resizedImageUri.uri }
        this.setState({
          avatarSource: source
        })

        // handle photo in props functions as data string
        if (this.props.onPhotoSelect) this.props.onPhotoSelect(photoData)
        */
      } catch(err) {
        if (this.props.onError) this.props.onError(err);
      }
    })
  }

  openImagePicker = async (camera = true) => {
    const _this = this;
    try {
      this.closeModal();
      // NOTE: the settimeout is needed because of a weird issue - where closing the modal
      // and launching the gallery doesnt work 
      // Ref: https://github.com/react-native-image-picker/react-native-image-picker/issues/728
      // Future Fix - move away from modal to some native action modal
      setTimeout(async () => {
        await this.performLaunchAction(camera);
      }, 100);
    } catch(err) {
      console.log(err);
      if (this.props.onError) this.props.onError(err);
    }
  }

  renderChildren = props => {
    return React.Children.map(props.children, child => {
      if (child && child.type === Image && this.state.avatarSource) {
        return React.cloneElement(child, {
          source: this.state.avatarSource
        })
      } else return child
    })
  }

  componentDidUpdate() {
    if (this.props.onAfterRender) this.props.onAfterRender(this.state)
  }

  render() {
    const { modalVisible } = this.state;
    return (
      <View style={[styles.container, this.props.containerStyle]}>
        <TouchableOpacity
          onPress={this.openModal}
          disabled={this.state.buttonDisabled}
        >
          {this.renderChildren(this.props)}
        </TouchableOpacity>
        <Modal
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => {
            this.closeModal();
          }}
        >
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <Pressable style={styles.textButton} onPress={() => this.openImagePicker(true)}>
                <Text style={styles.textOption}>Open Camera</Text>
              </Pressable>
              <Pressable style={styles.textOption}style={styles.textButton} onPress={() => this.openImagePicker(false)}>
                <Text style={styles.textOption}>Open Gallery</Text>
              </Pressable>
              <Pressable style={styles.textButton} onPress={() => this.closeModal()}>
                <Text style={styles.cancelOption}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22
  },
  modalView: {
    minWidth: 250,
    margin: 20,
    borderRadius: 4,
    padding: 10,
    backgroundColor: "#fefefe",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 3,
      height: 9
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  textButton: {
    alignSelf: "stretch",
    textAlign: "center",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#efefef'
  },
  textOption: {
    fontWeight: 'bold'
  },
  cancelOption: {

  }
});

async function requestCameraPermission () {
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: "Camera Permission",
        message: "Chakra needs to access your camera",
        buttonNeutral: "Ask Me Later",
        buttonNegative: "Cancel",
        buttonPositive: "OK"
      }
    );
    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
      console.log("Camera permission given");
      return true;
    } else {
      console.log("Camera permission denied");
      return false;
    }
  } catch (err) {
    console.log(err);
    return false;
  }
};