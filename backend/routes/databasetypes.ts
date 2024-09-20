import {
    ColumnType,
    Generated,
    Insertable,
    JSONColumnType,
    Selectable,
    Updateable,
} from 'kysely'



export interface Database {
    users: UserTable
    uservideos: UserVideosTables
    uservideotranscoded: UserVideosTranscodedTables
}

export interface UserTable {
    id: Generated<number>
    username: string
    hash: string
    email: string
    DOB: string
    fullname: string


}

export interface UserVideosTables {
    id: Generated<number>
    userid: number
    originalName: string
    mimeType: string
    size: number
    path: string
    newFilename: string
    duration: number
    bit_rate: number
    codec: string
    width: number
    height: number

}

export interface UserVideosTranscodedTables {
    id: Generated<number>
    userid: number
    originalName: string
    mimeType: string
    size: number
    path: string
    newFilename: string
    duration: number
    bit_rate: number
    codec: string
    width: number
    height: number
    userTranscodeID: number

}


export type UsersVideos = Selectable<UserVideosTables>
export type NewUsersVideos = Insertable<UserVideosTables>
export type UsersVideosUpdate = Updateable<UserVideosTables>


export type User = Selectable<UserTable>
export type NewUser = Insertable<UserTable>
export type UserUpdate = Updateable<UserTable>

export type UsersVideosTranscoded = Selectable<UserVideosTranscodedTables>
export type NewUsersVideosTranscoded = Insertable<UserVideosTranscodedTables>
