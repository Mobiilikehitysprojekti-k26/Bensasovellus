import { View, Text, StyleSheet } from 'react-native'
import React from 'react'
import MapView,{ Region, Marker } from 'react-native-maps'

interface MapProps {
    region: Region
}

const Map = ({ region }: MapProps) => {
  return (
    <MapView style={styles.map} region={region}>
        <Marker
            coordinate={{
                latitude: region.latitude,
                longitude: region.longitude
            }}
            title='Your location'
            description='You are here'
            pinColor='red'
        />
    </MapView>
  )
}

const styles = StyleSheet.create({
    map: {
        flex: 1,
        width: '100%',
        height: '100%'
    }
})

export default Map