import React from 'react';
import {Grid, Icon} from 'semantic-ui-react';

const style = {
    rowStyle:{ border: '1px solid #666', height: '86px'},
    noSpace:{ padding: '0 !important', margin: '0 !important'},
}

export class ExamHeader extends React.Component {
    render() {
        return <Grid>
            <Grid.Row divided style={style.rowStyle}>
                <Grid.Column width={7}>
                    Họ và tên: ...............................
                    <br/>
                    Số báo danh: ..........................
                    <br/>
                    Lớp: ........ -Phòng thi: ..........
                </Grid.Column>

                <Grid.Column width={3} style={{textAlign:'center'}}>
                    Chữ ký giám thị 1:
                </Grid.Column>

                <Grid.Column width={3} style={{textAlign:'center'}}>
                    Chữ ký giám thị 2:
                </Grid.Column>

                <Grid.Column width={3} style={{textAlign:'center'}}>
                    Mã phách:
                </Grid.Column>
            </Grid.Row>

            <Grid.Row style={style.noSpace}>
                <Icon name='cut' style={{float: "left"}} />
                <hr style={{border: '1px dashed #666', width: '95%'}}/>
            </Grid.Row>

            <Grid.Row divided style={style.rowStyle}>
                <Grid.Column width={3}>
                    Điểm bằng số:
                </Grid.Column>
                <Grid.Column width={4}>
                    Điểm bằng chữ:
                </Grid.Column>

                <Grid.Column width={3} style={{textAlign:'center'}}>
                    Chữ ký giám thị 1:
                </Grid.Column>

                <Grid.Column width={3} style={{textAlign:'center'}}>
                    Chữ ký giám thị 2:
                </Grid.Column>

                <Grid.Column width={3} style={{textAlign:'center'}}>
                    Mã phách:
                </Grid.Column>
            </Grid.Row>
        </Grid>
    }
}
